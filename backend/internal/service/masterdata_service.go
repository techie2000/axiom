package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
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

type languageEntry struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Native string `json:"native"`
	RTL    bool   `json:"rtl,omitempty"`
}

// LanguageData represents the JSON structure for languages
type LanguageData map[string]languageEntry

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
		log.Info().Int64("count", count).Msg("Continents already loaded, synchronizing from source file")
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

	sourceCodes := make(map[string]struct{}, len(continentsData))

	// Insert into database
	for code, name := range continentsData {
		code, name, ok := normalizeContinentEntry(code, name)
		if !ok {
			log.Warn().Str("code", code).Msg("Skipping continent entry with empty code or name")
			continue
		}
		sourceCodes[code] = struct{}{}

		var existing domain.Continent
		err := s.db.Where("code = ?", code).First(&existing).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				continent := &domain.Continent{Code: code, Name: name}
				if createErr := s.db.Create(continent).Error; createErr != nil {
					log.Warn().Err(createErr).Str("code", code).Msg("Failed to insert continent, skipping")
					continue
				}
				s.createContinentAudit("CREATE", *continent, map[string]map[string]interface{}{})
				continue
			}

			log.Warn().Err(err).Str("code", code).Msg("Failed to lookup continent, skipping")
			continue
		}

		changes := make(map[string]map[string]interface{})
		addChange(changes, "name", existing.Name, name)
		if len(changes) == 0 {
			continue
		}

		existing.Name = name
		if updateErr := s.db.Model(&domain.Continent{}).Where("code = ?", code).Updates(map[string]interface{}{
			"name":       name,
			"updated_at": gorm.Expr("NOW()"),
		}).Error; updateErr != nil {
			log.Warn().Err(updateErr).Str("code", code).Msg("Failed to update continent, skipping")
			continue
		}

		s.createContinentAudit("UPDATE", existing, changes)
	}

	var existing []domain.Continent
	if err := s.db.Find(&existing).Error; err != nil {
		return fmt.Errorf("failed to list continents for deletion sync: %w", err)
	}

	for _, continent := range existing {
		if _, exists := sourceCodes[continent.Code]; exists {
			continue
		}

		changes := map[string]map[string]interface{}{
			"source_presence": {"old": true, "new": false},
		}
		s.createContinentAudit("DELETE", continent, changes)

		if err := s.db.Where("code = ?", continent.Code).Delete(&domain.Continent{}).Error; err != nil {
			log.Warn().Err(err).Str("code", continent.Code).Msg("Failed to delete stale continent")
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
		log.Info().Int64("count", count).Msg("Languages already loaded, synchronizing from source file")
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

	sourceCodes := make(map[string]struct{}, len(languagesData))

	// Insert into database
	for key, lang := range languagesData {
		code := resolveLanguageCode(key, lang)

		if code == "" {
			log.Warn().Str("key", key).Msg("Skipping language entry with empty code")
			continue
		}
		sourceCodes[code] = struct{}{}

		var existing domain.Language
		err := s.db.Where("code = ?", code).First(&existing).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				language := &domain.Language{Code: code, Name: lang.Name, Native: lang.Native, RTL: lang.RTL}
				if createErr := s.db.Create(language).Error; createErr != nil {
					log.Warn().Err(createErr).Str("code", code).Msg("Failed to insert language, skipping")
					continue
				}
				s.createLanguageAudit("CREATE", *language, map[string]map[string]interface{}{})
				continue
			}

			log.Warn().Err(err).Str("code", code).Msg("Failed to lookup language, skipping")
			continue
		}

		changes := make(map[string]map[string]interface{})
		addChange(changes, "language_name", existing.Name, lang.Name)
		addChange(changes, "native_name", existing.Native, lang.Native)
		addChange(changes, "rtl", existing.RTL, lang.RTL)
		if len(changes) == 0 {
			continue
		}

		existing.Name = lang.Name
		existing.Native = lang.Native
		existing.RTL = lang.RTL

		if updateErr := s.db.Model(&domain.Language{}).Where("code = ?", code).Updates(map[string]interface{}{
			"language_name": lang.Name,
			"native_name":   lang.Native,
			"rtl":           lang.RTL,
			"updated_at":    gorm.Expr("NOW()"),
		}).Error; updateErr != nil {
			log.Warn().Err(updateErr).Str("code", code).Msg("Failed to update language, skipping")
			continue
		}

		s.createLanguageAudit("UPDATE", existing, changes)
	}

	var existing []domain.Language
	if err := s.db.Find(&existing).Error; err != nil {
		return fmt.Errorf("failed to list languages for deletion sync: %w", err)
	}

	for _, language := range existing {
		if _, exists := sourceCodes[language.Code]; exists {
			continue
		}

		changes := map[string]map[string]interface{}{
			"source_presence": {"old": true, "new": false},
		}
		s.createLanguageAudit("DELETE", language, changes)

		if err := s.db.Where("code = ?", language.Code).Delete(&domain.Language{}).Error; err != nil {
			log.Warn().Err(err).Str("code", language.Code).Msg("Failed to delete stale language")
		}
	}

	log.Info().Int("count", len(languagesData)).Msg("Languages loaded successfully")
	return nil
}

func resolveLanguageCode(key string, lang languageEntry) string {
	code := strings.TrimSpace(lang.Code)
	if code != "" {
		return code
	}

	return strings.TrimSpace(key)
}

func normalizeContinentEntry(code, name string) (string, string, bool) {
	normalizedCode := strings.TrimSpace(code)
	normalizedName := strings.TrimSpace(name)

	if normalizedCode == "" || normalizedName == "" {
		return normalizedCode, normalizedName, false
	}

	return normalizedCode, normalizedName, true
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

	sourceCodes := make(map[string]struct{}, len(currenciesData))

	// Insert into database
	for _, curr := range currenciesData {
		sourceCodes[curr.Code] = struct{}{}

		var existing domain.Currency
		err := s.db.Where("code = ?", curr.Code).First(&existing).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
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
				if createErr := s.db.Create(currency).Error; createErr != nil {
					log.Warn().Err(createErr).Str("code", curr.Code).Msg("Failed to insert currency, skipping")
					continue
				}
				s.createCurrencyAudit("CREATE", *currency, map[string]map[string]interface{}{})
				continue
			}

			log.Warn().Err(err).Str("code", curr.Code).Msg("Failed to lookup currency, skipping")
			continue
		}

		changes := make(map[string]map[string]interface{})
		addChange(changes, "name", existing.Name, curr.Name)
		addChange(changes, "symbol", existing.Symbol, curr.Symbol)
		addChange(changes, "symbol_native", existing.SymbolNative, curr.SymbolNative)
		addChange(changes, "decimal_digits", existing.DecimalDigits, curr.DecimalDigits)
		addChange(changes, "rounding", existing.Rounding, curr.Rounding)
		addChange(changes, "name_plural", existing.NamePlural, curr.NamePlural)
		addChange(changes, "active", existing.Active, true)
		addChange(changes, "is_alert_cls_allowed", existing.IsAlertClsAllowed, curr.IsAlertClsAllowed)
		addChange(changes, "is_ofac_sanctioned", existing.IsOfacSanctioned, curr.IsOfacSanctioned)
		if len(changes) == 0 {
			continue
		}

		existing.Name = curr.Name
		existing.Symbol = curr.Symbol
		existing.SymbolNative = curr.SymbolNative
		existing.DecimalDigits = curr.DecimalDigits
		existing.Rounding = curr.Rounding
		existing.NamePlural = curr.NamePlural
		existing.Active = true
		existing.IsAlertClsAllowed = curr.IsAlertClsAllowed
		existing.IsOfacSanctioned = curr.IsOfacSanctioned

		if updateErr := s.db.Model(&domain.Currency{}).Where("code = ?", curr.Code).Updates(map[string]interface{}{
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
		}).Error; updateErr != nil {
			log.Warn().Err(updateErr).Str("code", curr.Code).Msg("Failed to update currency, skipping")
			continue
		}

		s.createCurrencyAudit("UPDATE", existing, changes)
	}

	var staleCurrencies []domain.Currency
	if err := s.db.Where("active = ?", true).Find(&staleCurrencies).Error; err != nil {
		return fmt.Errorf("failed to list currencies for deletion sync: %w", err)
	}

	for _, currency := range staleCurrencies {
		if _, exists := sourceCodes[currency.Code]; exists {
			continue
		}

		changes := map[string]map[string]interface{}{
			"active":          {"old": true, "new": false},
			"source_presence": {"old": true, "new": false},
		}

		currency.Active = false
		s.createCurrencyAudit("DELETE", currency, changes)

		if err := s.db.Model(&domain.Currency{}).Where("code = ?", currency.Code).Updates(map[string]interface{}{
			"active":     false,
			"updated_at": gorm.Expr("NOW()"),
		}).Error; err != nil {
			log.Warn().Err(err).Str("code", currency.Code).Msg("Failed to deactivate stale currency")
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

	sourceCodes := make(map[string]struct{}, len(countriesData))

	// Insert into database
	for _, countryData := range countriesData {
		sourceCodes[countryData.Code] = struct{}{}

		// Convert arrays to JSON strings
		phoneCodesJSON, _ := json.Marshal(countryData.PhoneCodes)
		currencyCodesJSON, _ := json.Marshal(countryData.CurrencyCodes)
		languagesJSON, _ := json.Marshal(countryData.Languages)

		var existing domain.Country
		err := s.db.Where("code = ?", countryData.Code).First(&existing).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
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
				if createErr := s.db.Create(country).Error; createErr != nil {
					log.Warn().Err(createErr).Str("code", countryData.Code).Msg("Failed to insert country, skipping")
					continue
				}
				s.createCountryAudit("CREATE", *country, map[string]map[string]interface{}{})
				continue
			}

			log.Warn().Err(err).Str("code", countryData.Code).Msg("Failed to lookup country, skipping")
			continue
		}

		changes := make(map[string]map[string]interface{})
		addChange(changes, "alpha3_code", existing.Alpha3Code, countryData.Alpha3Code)
		addChange(changes, "name", existing.Name, countryData.Name)
		addChange(changes, "native_name", existing.NativeName, countryData.NativeName)
		addChange(changes, "phone_codes", existing.PhoneCodes, string(phoneCodesJSON))
		addChange(changes, "continent", existing.Continent, countryData.Continent)
		addChange(changes, "capital", existing.Capital, countryData.Capital)
		addChange(changes, "currency_codes", existing.CurrencyCodes, string(currencyCodesJSON))
		addChange(changes, "languages", existing.Languages, string(languagesJSON))
		addChange(changes, "region", existing.Region, countryData.Region)
		addChange(changes, "active", existing.Active, true)
		if len(changes) == 0 {
			continue
		}

		existing.Alpha3Code = countryData.Alpha3Code
		existing.Name = countryData.Name
		existing.NativeName = countryData.NativeName
		existing.PhoneCodes = string(phoneCodesJSON)
		existing.Continent = countryData.Continent
		existing.Capital = countryData.Capital
		existing.CurrencyCodes = string(currencyCodesJSON)
		existing.Languages = string(languagesJSON)
		existing.Region = countryData.Region
		existing.Active = true

		if updateErr := s.db.Model(&domain.Country{}).Where("code = ?", countryData.Code).Updates(map[string]interface{}{
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
		}).Error; updateErr != nil {
			log.Warn().Err(updateErr).Str("code", countryData.Code).Msg("Failed to update country, skipping")
			continue
		}

		s.createCountryAudit("UPDATE", existing, changes)
	}

	var staleCountries []domain.Country
	if err := s.db.Where("active = ?", true).Find(&staleCountries).Error; err != nil {
		return fmt.Errorf("failed to list countries for deletion sync: %w", err)
	}

	for _, country := range staleCountries {
		if _, exists := sourceCodes[country.Code]; exists {
			continue
		}

		changes := map[string]map[string]interface{}{
			"active":          {"old": true, "new": false},
			"source_presence": {"old": true, "new": false},
		}

		country.Active = false
		s.createCountryAudit("DELETE", country, changes)

		if err := s.db.Model(&domain.Country{}).Where("code = ?", country.Code).Updates(map[string]interface{}{
			"active":     false,
			"updated_at": gorm.Expr("NOW()"),
		}).Error; err != nil {
			log.Warn().Err(err).Str("code", country.Code).Msg("Failed to deactivate stale country")
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
		log.Info().Int64("count", count).Msg("ALERT Direct country code mappings already loaded, synchronizing from source file")
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

	sourceKeys := make(map[string]struct{}, len(mappingsData))

	// Insert into database
	for _, m := range mappingsData {
		m, ok := normalizeCodeMappingEntry(m)
		if !ok {
			log.Warn().Interface("mapping", m).Msg("Skipping code mapping entry with empty required key fields")
			continue
		}
		sourceKeys[codeMappingKey(m.FromSystem, m.ToSystem, m.FromCodeType, m.ToCodeType, m.FromCode)] = struct{}{}

		var existing domain.CodeMapping
		err := s.db.Where("from_system = ? AND to_system = ? AND from_code_type = ? AND to_code_type = ? AND from_code = ? AND deleted_at IS NULL",
			m.FromSystem, m.ToSystem, m.FromCodeType, m.ToCodeType, m.FromCode).First(&existing).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
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
				if createErr := s.db.Create(mapping).Error; createErr != nil {
					log.Warn().Err(createErr).
						Str("from_code", m.FromCode).
						Str("to_code", m.ToCode).
						Msg("Failed to insert code mapping, skipping")
					continue
				}
				s.createCodeMappingAudit("CREATE", *mapping, map[string]map[string]interface{}{})
				continue
			}

			log.Warn().Err(err).
				Str("from_code", m.FromCode).
				Str("to_code", m.ToCode).
				Msg("Failed to lookup code mapping, skipping")
			continue
		}

		changes := make(map[string]map[string]interface{})
		addChange(changes, "to_code", existing.ToCode, m.ToCode)
		addChange(changes, "description", existing.Description, m.Description)
		addChange(changes, "active", existing.Active, true)
		if len(changes) == 0 {
			continue
		}

		existing.ToCode = m.ToCode
		existing.Description = m.Description
		existing.Active = true

		if updateErr := s.db.Model(&domain.CodeMapping{}).
			Where("id = ?", existing.ID).
			Updates(map[string]interface{}{
				"to_code":     m.ToCode,
				"description": m.Description,
				"active":      true,
				"updated_at":  gorm.Expr("NOW()"),
			}).Error; updateErr != nil {
			log.Warn().Err(updateErr).
				Str("from_code", m.FromCode).
				Str("to_code", m.ToCode).
				Msg("Failed to update code mapping, skipping")
			continue
		}

		s.createCodeMappingAudit("UPDATE", existing, changes)
	}

	var existingMappings []domain.CodeMapping
	if err := s.db.Where("from_system = ? AND from_code_type = ? AND deleted_at IS NULL AND active = ?", "ALERT", "ALERT_DIRECT_COUNTRY_CODE", true).Find(&existingMappings).Error; err != nil {
		return fmt.Errorf("failed to list code mappings for deletion sync: %w", err)
	}

	for _, mapping := range existingMappings {
		k := codeMappingKey(mapping.FromSystem, mapping.ToSystem, mapping.FromCodeType, mapping.ToCodeType, mapping.FromCode)
		if _, exists := sourceKeys[k]; exists {
			continue
		}

		changes := map[string]map[string]interface{}{
			"active":          {"old": true, "new": false},
			"source_presence": {"old": true, "new": false},
		}

		mapping.Active = false
		s.createCodeMappingAudit("DELETE", mapping, changes)

		if err := s.db.Model(&domain.CodeMapping{}).Where("id = ?", mapping.ID).Updates(map[string]interface{}{
			"active":     false,
			"updated_at": gorm.Expr("NOW()"),
		}).Error; err != nil {
			log.Warn().Err(err).Str("from_code", mapping.FromCode).Msg("Failed to deactivate stale code mapping")
		}
	}

	log.Info().Int("count", len(mappingsData)).Msg("ALERT Direct country code mappings loaded successfully")
	return nil
}

func codeMappingKey(fromSystem, toSystem, fromCodeType, toCodeType, fromCode string) string {
	return strings.Join([]string{fromSystem, toSystem, fromCodeType, toCodeType, fromCode}, "|")
}

func normalizeCodeMappingEntry(m CodeMappingData) (CodeMappingData, bool) {
	m.FromSystem = strings.TrimSpace(m.FromSystem)
	m.ToSystem = strings.TrimSpace(m.ToSystem)
	m.FromCodeType = strings.TrimSpace(m.FromCodeType)
	m.ToCodeType = strings.TrimSpace(m.ToCodeType)
	m.FromCode = strings.TrimSpace(m.FromCode)
	m.ToCode = strings.TrimSpace(m.ToCode)
	m.Description = strings.TrimSpace(m.Description)

	if m.FromSystem == "" || m.ToSystem == "" || m.FromCodeType == "" || m.ToCodeType == "" || m.FromCode == "" || m.ToCode == "" {
		return m, false
	}

	return m, true
}

func toJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to marshal JSON payload")
		return "{}"
	}
	return string(b)
}

func toChangedFieldsJSON(changes map[string]map[string]interface{}) string {
	if len(changes) == 0 {
		return "{}"
	}
	return toJSON(changes)
}

func addChange(changes map[string]map[string]interface{}, field string, oldValue, newValue interface{}) {
	if reflect.DeepEqual(oldValue, newValue) {
		return
	}
	changes[field] = map[string]interface{}{"old": oldValue, "new": newValue}
}

func (s *masterDataService) createContinentAudit(action string, continent domain.Continent, changes map[string]map[string]interface{}) {
	audit := &domain.ContinentAudit{
		ContinentCode:  continent.Code,
		Action:         action,
		RecordSnapshot: toJSON(continent),
		ChangedFields:  toChangedFieldsJSON(changes),
		ChangedBy:      "system",
	}
	if err := s.db.Create(audit).Error; err != nil {
		log.Warn().Err(err).Str("continent_code", continent.Code).Str("action", action).Msg("Failed to create continent audit record")
	}
}

func (s *masterDataService) createLanguageAudit(action string, language domain.Language, changes map[string]map[string]interface{}) {
	audit := &domain.LanguageAudit{
		LanguageCode:   language.Code,
		Action:         action,
		RecordSnapshot: toJSON(language),
		ChangedFields:  toChangedFieldsJSON(changes),
		ChangedBy:      "system",
	}
	if err := s.db.Create(audit).Error; err != nil {
		log.Warn().Err(err).Str("language_code", language.Code).Str("action", action).Msg("Failed to create language audit record")
	}
}

func (s *masterDataService) createCurrencyAudit(action string, currency domain.Currency, changes map[string]map[string]interface{}) {
	audit := &domain.CurrencyAudit{
		CurrencyID:     currency.ID,
		Code:           currency.Code,
		Action:         action,
		RecordSnapshot: toJSON(currency),
		ChangedFields:  toChangedFieldsJSON(changes),
		ChangedBy:      "system",
	}
	if err := s.db.Create(audit).Error; err != nil {
		log.Warn().Err(err).Str("currency_code", currency.Code).Str("action", action).Msg("Failed to create currency audit record")
	}
}

func (s *masterDataService) createCountryAudit(action string, country domain.Country, changes map[string]map[string]interface{}) {
	audit := &domain.CountryAudit{
		CountryID:      country.ID,
		Code:           country.Code,
		Action:         action,
		RecordSnapshot: toJSON(country),
		ChangedFields:  toChangedFieldsJSON(changes),
		ChangedBy:      "system",
	}
	if err := s.db.Create(audit).Error; err != nil {
		log.Warn().Err(err).Str("country_code", country.Code).Str("action", action).Msg("Failed to create country audit record")
	}
}

func (s *masterDataService) createCodeMappingAudit(action string, mapping domain.CodeMapping, changes map[string]map[string]interface{}) {
	audit := &domain.CodeMappingAudit{
		CodeMappingID:  mapping.ID,
		FromSystem:     mapping.FromSystem,
		ToSystem:       mapping.ToSystem,
		FromCodeType:   mapping.FromCodeType,
		ToCodeType:     mapping.ToCodeType,
		FromCode:       mapping.FromCode,
		ToCode:         mapping.ToCode,
		Action:         action,
		RecordSnapshot: toJSON(mapping),
		ChangedFields:  toChangedFieldsJSON(changes),
		ChangedBy:      "system",
	}
	if err := s.db.Create(audit).Error; err != nil {
		log.Warn().Err(err).Str("from_code", mapping.FromCode).Str("action", action).Msg("Failed to create code mapping audit record")
	}
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
