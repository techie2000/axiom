package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MasterDataService handles loading and synchronizing master data
type MasterDataService interface {
	LoadAllMasterData() error
	LoadContinents() error
	LoadLanguages() error
	LoadCurrencies() error
	LoadCountries() error
	LoadCodeMappings() error
	CheckForUpdates() (bool, error)
}

type masterDataService struct {
	db                       *gorm.DB
	dataDir                  string
	fingerprintMu            sync.Mutex
	lastKnownDataFingerprint string
}

// NewMasterDataService creates a new master data service
func NewMasterDataService(db *gorm.DB, dataDir string) MasterDataService {
	return &masterDataService{
		db:      db,
		dataDir: dataDir,
	}
}

// ContinentData represents the JSON structure for continents
type ContinentData map[string]string

// LanguageData represents the JSON structure for languages
type LanguageData map[string]struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Native string `json:"native"`
	RTL    bool   `json:"rtl,omitempty"`
}

// CurrencyData represents the JSON structure for currencies
type CurrencyData map[string]struct {
	Code              string `json:"code"`
	Name              string `json:"name"`
	Symbol            string `json:"symbol"`
	SymbolNative      string `json:"symbol_native"`
	DecimalDigits     int    `json:"decimal_digits"`
	Rounding          int    `json:"rounding"`
	NamePlural        string `json:"name_plural"`
	IsAlertClsAllowed bool   `json:"is_alert_cls_allowed"`
	IsOfacSanctioned  bool   `json:"is_ofac_sanctioned"`
}

// CodeMappingData represents the JSON structure for a code mapping entry
type CodeMappingData struct {
	FromSystem   string `json:"from_system"`
	ToSystem     string `json:"to_system"`
	FromCodeType string `json:"from_code_type"`
	ToCodeType   string `json:"to_code_type"`
	FromCode     string `json:"from_code"`
	ToCode       string `json:"to_code"`
	Description  string `json:"description"`
}

// CountryData represents the JSON structure for countries
type CountryData struct {
	Code          string   `json:"code"`
	Alpha3Code    string   `json:"alpha3_code"`
	Name          string   `json:"name"`
	NativeName    string   `json:"native_name"`
	PhoneCodes    []int    `json:"phone_codes"`
	Continent     string   `json:"continent"`
	Capital       string   `json:"capital"`
	CurrencyCodes []string `json:"currency_codes"`
	Languages     []string `json:"languages"`
	Region        string   `json:"region"`
}

// LoadAllMasterData loads all master data in the correct order
func (s *masterDataService) LoadAllMasterData() error {
	log.Info().Msg("Loading master data...")

	// Load in dependency order
	if err := s.LoadContinents(); err != nil {
		return fmt.Errorf("failed to load continents: %w", err)
	}

	if err := s.LoadLanguages(); err != nil {
		return fmt.Errorf("failed to load languages: %w", err)
	}

	if err := s.LoadCurrencies(); err != nil {
		return fmt.Errorf("failed to load currencies: %w", err)
	}

	if err := s.LoadCountries(); err != nil {
		return fmt.Errorf("failed to load countries: %w", err)
	}

	if err := s.LoadCodeMappings(); err != nil {
		return fmt.Errorf("failed to load code mappings: %w", err)
	}

	if err := s.captureCurrentFingerprint(); err != nil {
		log.Warn().Err(err).Msg("Failed to capture master data fingerprint after load")
	}

	log.Info().Msg("Master data loaded successfully")
	return nil
}

// LoadContinents loads continent data from JSON file
func (s *masterDataService) LoadContinents() error {
	// Check if data already exists
	var count int64
	if err := s.db.Model(&domain.Continent{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check continents: %w", err)
	}

	if count > 0 {
		log.Info().Int64("count", count).Msg("Continents already loaded, skipping")
		return nil
	}

	// Read JSON file
	filePath := filepath.Join(s.dataDir, "continents.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read continents.json: %w", err)
	}

	// Parse JSON
	var continentsData ContinentData
	if err := json.Unmarshal(data, &continentsData); err != nil {
		return fmt.Errorf("failed to parse continents.json: %w", err)
	}

	// Insert into database
	now := time.Now()
	for code, name := range continentsData {
		continent := &domain.Continent{
			Code:      code,
			Name:      name,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.db.Create(continent).Error; err != nil {
			log.Warn().Err(err).Str("code", code).Msg("Failed to insert continent, skipping")
		}
	}

	log.Info().Int("count", len(continentsData)).Msg("Continents loaded successfully")
	return nil
}

// LoadLanguages loads language data from JSON file
func (s *masterDataService) LoadLanguages() error {
	// Check if data already exists
	var count int64
	if err := s.db.Model(&domain.Language{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check languages: %w", err)
	}

	if count > 0 {
		log.Info().Int64("count", count).Msg("Languages already loaded, skipping")
		return nil
	}

	// Read JSON file
	filePath := filepath.Join(s.dataDir, "languages.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read languages.json: %w", err)
	}

	// Parse JSON
	var languagesData LanguageData
	if err := json.Unmarshal(data, &languagesData); err != nil {
		return fmt.Errorf("failed to parse languages.json: %w", err)
	}

	// Insert into database
	now := time.Now()
	for code, lang := range languagesData {
		language := &domain.Language{
			Code:      code,
			Name:      lang.Name,
			Native:    lang.Native,
			RTL:       lang.RTL,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.db.Create(language).Error; err != nil {
			log.Warn().Err(err).Str("code", code).Msg("Failed to insert language, skipping")
		}
	}

	log.Info().Int("count", len(languagesData)).Msg("Languages loaded successfully")
	return nil
}

// LoadCurrencies loads currency data from JSON file
func (s *masterDataService) LoadCurrencies() error {
	// Check if data already exists
	var count int64
	if err := s.db.Model(&domain.Currency{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check currencies: %w", err)
	}

	if count > 0 {
		log.Info().Int64("count", count).Msg("Currencies already loaded, synchronizing from source file")
	}

	// Read JSON file
	filePath := filepath.Join(s.dataDir, "currencies.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read currencies.json: %w", err)
	}

	// Parse JSON
	var currenciesData CurrencyData
	if err := json.Unmarshal(data, &currenciesData); err != nil {
		return fmt.Errorf("failed to parse currencies.json: %w", err)
	}

	// Insert into database
	for _, curr := range currenciesData {
		currency := &domain.Currency{
			Code:              curr.Code,
			Name:              curr.Name,
			Symbol:            curr.Symbol,
			SymbolNative:      curr.SymbolNative,
			DecimalDigits:     curr.DecimalDigits,
			Rounding:          curr.Rounding,
			NamePlural:        curr.NamePlural,
			Active:            true,
			IsAlertClsAllowed: curr.IsAlertClsAllowed,
			IsOfacSanctioned:  curr.IsOfacSanctioned,
		}
		if err := s.db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "code"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"name":                 curr.Name,
				"symbol":               curr.Symbol,
				"symbol_native":        curr.SymbolNative,
				"decimal_digits":       curr.DecimalDigits,
				"rounding":             curr.Rounding,
				"name_plural":          curr.NamePlural,
				"active":               true,
				"is_alert_cls_allowed": curr.IsAlertClsAllowed,
				"is_ofac_sanctioned":   curr.IsOfacSanctioned,
				"updated_at":           gorm.Expr("NOW()"),
			}),
		}).Create(currency).Error; err != nil {
			log.Warn().Err(err).Str("code", curr.Code).Msg("Failed to insert currency, skipping")
		}
	}

	log.Info().Int("count", len(currenciesData)).Msg("Currencies loaded successfully")
	return nil
}

// LoadCountries loads country data from JSON file
func (s *masterDataService) LoadCountries() error {
	// Check if data already exists
	var count int64
	if err := s.db.Model(&domain.Country{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check countries: %w", err)
	}

	if count > 0 {
		log.Info().Int64("count", count).Msg("Countries already loaded, synchronizing from source file")
	}

	// Read JSON file
	filePath := filepath.Join(s.dataDir, "countries.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read countries.json: %w", err)
	}

	// Parse JSON
	var countriesData []CountryData
	if err := json.Unmarshal(data, &countriesData); err != nil {
		return fmt.Errorf("failed to parse countries.json: %w", err)
	}

	// Insert into database
	for _, countryData := range countriesData {
		// Convert arrays to JSON strings
		phoneCodesJSON, _ := json.Marshal(countryData.PhoneCodes)
		currencyCodesJSON, _ := json.Marshal(countryData.CurrencyCodes)
		languagesJSON, _ := json.Marshal(countryData.Languages)

		country := &domain.Country{
			Code:          countryData.Code,
			Alpha3Code:    countryData.Alpha3Code,
			Name:          countryData.Name,
			NativeName:    countryData.NativeName,
			PhoneCodes:    string(phoneCodesJSON),
			Continent:     countryData.Continent,
			Capital:       countryData.Capital,
			CurrencyCodes: string(currencyCodesJSON),
			Languages:     string(languagesJSON),
			Region:        countryData.Region,
			Active:        true,
		}
		if err := s.db.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "code"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"alpha3_code":    countryData.Alpha3Code,
				"name":           countryData.Name,
				"native_name":    countryData.NativeName,
				"phone_codes":    string(phoneCodesJSON),
				"continent":      countryData.Continent,
				"capital":        countryData.Capital,
				"currency_codes": string(currencyCodesJSON),
				"languages":      string(languagesJSON),
				"region":         countryData.Region,
				"active":         true,
				"updated_at":     gorm.Expr("NOW()"),
			}),
		}).Create(country).Error; err != nil {
			log.Warn().Err(err).Str("code", countryData.Code).Msg("Failed to insert country, skipping")
		}
	}

	log.Info().Int("count", len(countriesData)).Msg("Countries loaded successfully")
	return nil
}

// LoadCodeMappings loads ALERT Direct country code mappings from JSON file
func (s *masterDataService) LoadCodeMappings() error {
	// Check if ALERT Direct country code mappings already exist
	var count int64
	if err := s.db.Model(&domain.CodeMapping{}).
		Where("from_system = ? AND from_code_type = ?", "ALERT", "ALERT_DIRECT_COUNTRY_CODE").
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check code mappings: %w", err)
	}

	if count > 0 {
		log.Info().Int64("count", count).Msg("ALERT Direct country code mappings already loaded, skipping")
		return nil
	}

	// Read JSON file
	filePath := filepath.Join(s.dataDir, "alert_country_codes.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read alert_country_codes.json: %w", err)
	}

	// Parse JSON
	var mappingsData []CodeMappingData
	if err := json.Unmarshal(data, &mappingsData); err != nil {
		return fmt.Errorf("failed to parse alert_country_codes.json: %w", err)
	}

	// Insert into database
	for _, m := range mappingsData {
		mapping := &domain.CodeMapping{
			FromSystem:   m.FromSystem,
			ToSystem:     m.ToSystem,
			FromCodeType: m.FromCodeType,
			ToCodeType:   m.ToCodeType,
			FromCode:     m.FromCode,
			ToCode:       m.ToCode,
			Description:  m.Description,
			Active:       true,
			CreatedBy:    "system",
		}
		if err := s.db.Create(mapping).Error; err != nil {
			log.Warn().Err(err).
				Str("from_code", m.FromCode).
				Str("to_code", m.ToCode).
				Msg("Failed to insert code mapping, skipping")
		}
	}

	log.Info().Int("count", len(mappingsData)).Msg("ALERT Direct country code mappings loaded successfully")
	return nil
}

// CheckForUpdates checks if master data files have been updated
func (s *masterDataService) CheckForUpdates() (bool, error) {
	currentFingerprint, err := s.computeDataFingerprint()
	if err != nil {
		return false, err
	}

	s.fingerprintMu.Lock()
	defer s.fingerprintMu.Unlock()

	if s.lastKnownDataFingerprint == "" {
		s.lastKnownDataFingerprint = currentFingerprint
		log.Info().
			Str("fingerprint", currentFingerprint).
			Msg("Master data fingerprint initialized")
		return false, nil
	}

	if currentFingerprint != s.lastKnownDataFingerprint {
		oldFingerprint := s.lastKnownDataFingerprint
		s.lastKnownDataFingerprint = currentFingerprint
		log.Info().
			Str("previous_fingerprint", oldFingerprint).
			Str("current_fingerprint", currentFingerprint).
			Msg("Master data update detected via fingerprint change")
		return true, nil
	}

	return false, nil
}

func (s *masterDataService) captureCurrentFingerprint() error {
	fingerprint, err := s.computeDataFingerprint()
	if err != nil {
		return err
	}

	s.fingerprintMu.Lock()
	defer s.fingerprintMu.Unlock()
	s.lastKnownDataFingerprint = fingerprint
	return nil
}

func (s *masterDataService) computeDataFingerprint() (string, error) {
	masterDataFiles := []string{
		"continents.json",
		"languages.json",
		"currencies.json",
		"countries.json",
		"alert_country_codes.json",
	}
	sort.Strings(masterDataFiles)

	hasher := sha256.New()
	for _, fileName := range masterDataFiles {
		filePath := filepath.Join(s.dataDir, fileName)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to read %s: %w", fileName, err)
		}

		fileHash := sha256.Sum256(content)
		if _, err := hasher.Write([]byte(fileName)); err != nil {
			return "", fmt.Errorf("failed to hash file name %s: %w", fileName, err)
		}
		if _, err := hasher.Write([]byte(":")); err != nil {
			return "", fmt.Errorf("failed to hash separator for %s: %w", fileName, err)
		}
		if _, err := hasher.Write([]byte(hex.EncodeToString(fileHash[:]))); err != nil {
			return "", fmt.Errorf("failed to hash digest for %s: %w", fileName, err)
		}
		if _, err := hasher.Write([]byte(";")); err != nil {
			return "", fmt.Errorf("failed to hash entry separator for %s: %w", fileName, err)
		}
	}

	return strings.ToLower(hex.EncodeToString(hasher.Sum(nil))), nil
}
