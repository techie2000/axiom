package repository

import (
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
)

// Repositories holds all repository interfaces
type Repositories struct {
	Country        CountryRepository
	Currency       CurrencyRepository
	Language       LanguageRepository
	Entity         EntityRepository
	Instrument     InstrumentRepository
	Account        AccountRepository
	SSI            SSIRepository
	LEI            LEIRepository
	LEILevel2      LEILevel2Repository
	CodeMapping    CodeMappingRepository
	User           UserRepository
	UserPreference UserPreferenceRepository
	UITranslation  UITranslationRepository
}

// NewRepositories creates a new repositories instance
func NewRepositories(db *gorm.DB) *Repositories {
	return &Repositories{
		Country:        NewCountryRepository(db),
		Currency:       NewCurrencyRepository(db),
		Language:       NewLanguageRepository(db),
		Entity:         NewEntityRepository(db),
		Instrument:     NewInstrumentRepository(db),
		Account:        NewAccountRepository(db),
		SSI:            NewSSIRepository(db),
		LEI:            NewLEIRepository(db),
		LEILevel2:      NewLEILevel2Repository(db),
		CodeMapping:    NewCodeMappingRepository(db),
		User:           NewUserRepository(db),
		UserPreference: NewUserPreferenceRepository(db),
		UITranslation:  NewUITranslationRepository(db),
	}
}

// CountryRepository interface
type CountryRepository interface {
	Create(country *domain.Country) error
	FindByID(id string) (*domain.Country, error)
	FindAll(limit, offset int) ([]*domain.Country, error)
	Update(country *domain.Country) error
	Delete(id string) error
}

type countryRepository struct {
	db *gorm.DB
}

func NewCountryRepository(db *gorm.DB) CountryRepository {
	return &countryRepository{db: db}
}

func (r *countryRepository) Create(country *domain.Country) error {
	return r.db.Create(country).Error
}

func (r *countryRepository) FindByID(id string) (*domain.Country, error) {
	var country domain.Country
	if err := r.db.First(&country, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &country, nil
}

func (r *countryRepository) FindAll(limit, offset int) ([]*domain.Country, error) {
	var countries []*domain.Country
	if err := r.db.Limit(limit).Offset(offset).Find(&countries).Error; err != nil {
		return nil, err
	}
	return countries, nil
}

func (r *countryRepository) Update(country *domain.Country) error {
	return r.db.Save(country).Error
}

func (r *countryRepository) Delete(id string) error {
	return r.db.Delete(&domain.Country{}, "id = ?", id).Error
}

// CurrencyRepository interface
type CurrencyRepository interface {
	Create(currency *domain.Currency) error
	FindByID(id string) (*domain.Currency, error)
	FindAll(limit, offset int) ([]*domain.Currency, error)
	Update(currency *domain.Currency) error
	Delete(id string) error
}

type currencyRepository struct {
	db *gorm.DB
}

func NewCurrencyRepository(db *gorm.DB) CurrencyRepository {
	return &currencyRepository{db: db}
}

func (r *currencyRepository) Create(currency *domain.Currency) error {
	return r.db.Create(currency).Error
}

func (r *currencyRepository) FindByID(id string) (*domain.Currency, error) {
	var currency domain.Currency
	if err := r.db.First(&currency, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &currency, nil
}

func (r *currencyRepository) FindAll(limit, offset int) ([]*domain.Currency, error) {
	var currencies []*domain.Currency
	if err := r.db.Limit(limit).Offset(offset).Find(&currencies).Error; err != nil {
		return nil, err
	}
	return currencies, nil
}

func (r *currencyRepository) Update(currency *domain.Currency) error {
	return r.db.Save(currency).Error
}

func (r *currencyRepository) Delete(id string) error {
	return r.db.Delete(&domain.Currency{}, "id = ?", id).Error
}

// LanguageRepository interface
type LanguageRepository interface {
	FindAll(limit, offset int) ([]*domain.Language, error)
}

type languageRepository struct {
	db *gorm.DB
}

func NewLanguageRepository(db *gorm.DB) LanguageRepository {
	return &languageRepository{db: db}
}

func (r *languageRepository) FindAll(limit, offset int) ([]*domain.Language, error) {
	var languages []*domain.Language
	if err := r.db.Order("code ASC").Limit(limit).Offset(offset).Find(&languages).Error; err != nil {
		return nil, err
	}
	return languages, nil
}

// Additional repository implementations for Entity, Instrument, Account, SSI
// (Following same pattern as above)

type EntityRepository interface {
	Create(entity *domain.Entity) error
	FindByID(id string) (*domain.Entity, error)
	FindAll(limit, offset int) ([]*domain.Entity, error)
	Update(entity *domain.Entity) error
	Delete(id string) error
}

type entityRepository struct {
	db *gorm.DB
}

var entityRelationPreloads = []string{
	"Addresses",
	"Addresses.Address",
	"Addresses.Address.Country",
}

func applyEntityPreloads(db *gorm.DB) *gorm.DB {
	for _, relation := range entityRelationPreloads {
		db = db.Preload(relation)
	}
	return db
}

func NewEntityRepository(db *gorm.DB) EntityRepository {
	return &entityRepository{db: db}
}

func (r *entityRepository) Create(entity *domain.Entity) error {
	return r.db.Create(entity).Error
}

func (r *entityRepository) FindByID(id string) (*domain.Entity, error) {
	var entity domain.Entity
	if err := applyEntityPreloads(r.db).First(&entity, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *entityRepository) FindAll(limit, offset int) ([]*domain.Entity, error) {
	var entities []*domain.Entity
	if err := applyEntityPreloads(r.db).Limit(limit).Offset(offset).Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *entityRepository) Update(entity *domain.Entity) error {
	return r.db.Save(entity).Error
}

func (r *entityRepository) Delete(id string) error {
	return r.db.Delete(&domain.Entity{}, "id = ?", id).Error
}

// InstrumentRepository interface
type InstrumentRepository interface {
	Create(instrument *domain.Instrument) error
	FindByID(id string) (*domain.Instrument, error)
	FindAll(limit, offset int) ([]*domain.Instrument, error)
	Update(instrument *domain.Instrument) error
	Delete(id string) error
}

type instrumentRepository struct {
	db *gorm.DB
}

func NewInstrumentRepository(db *gorm.DB) InstrumentRepository {
	return &instrumentRepository{db: db}
}

func (r *instrumentRepository) Create(instrument *domain.Instrument) error {
	return r.db.Create(instrument).Error
}

func (r *instrumentRepository) FindByID(id string) (*domain.Instrument, error) {
	var instrument domain.Instrument
	if err := r.db.Preload("IssueCurrency").Preload("Codes").First(&instrument, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &instrument, nil
}

func (r *instrumentRepository) FindAll(limit, offset int) ([]*domain.Instrument, error) {
	var instruments []*domain.Instrument
	if err := r.db.Preload("IssueCurrency").Preload("Codes").Limit(limit).Offset(offset).Find(&instruments).Error; err != nil {
		return nil, err
	}
	return instruments, nil
}

func (r *instrumentRepository) Update(instrument *domain.Instrument) error {
	return r.db.Save(instrument).Error
}

func (r *instrumentRepository) Delete(id string) error {
	return r.db.Delete(&domain.Instrument{}, "id = ?", id).Error
}

// AccountRepository interface
type AccountRepository interface {
	Create(account *domain.Account) error
	FindByID(id string) (*domain.Account, error)
	FindAll(limit, offset int) ([]*domain.Account, error)
	Update(account *domain.Account) error
	Delete(id string) error
}

type accountRepository struct {
	db *gorm.DB
}

func NewAccountRepository(db *gorm.DB) AccountRepository {
	return &accountRepository{db: db}
}

func (r *accountRepository) Create(account *domain.Account) error {
	return r.db.Create(account).Error
}

func (r *accountRepository) FindByID(id string) (*domain.Account, error) {
	var account domain.Account
	if err := r.db.Preload("Entity").Preload("AccountCurrency").First(&account, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) FindAll(limit, offset int) ([]*domain.Account, error) {
	var accounts []*domain.Account
	if err := r.db.Preload("Entity").Preload("AccountCurrency").Limit(limit).Offset(offset).Find(&accounts).Error; err != nil {
		return nil, err
	}
	return accounts, nil
}

func (r *accountRepository) Update(account *domain.Account) error {
	return r.db.Save(account).Error
}

func (r *accountRepository) Delete(id string) error {
	return r.db.Delete(&domain.Account{}, "id = ?", id).Error
}

// SSIRepository interface
type SSIRepository interface {
	Create(ssi *domain.SSI) error
	FindByID(id string) (*domain.SSI, error)
	FindAll(limit, offset int) ([]*domain.SSI, error)
	Update(ssi *domain.SSI) error
	Delete(id string) error
}

type ssiRepository struct {
	db *gorm.DB
}

func NewSSIRepository(db *gorm.DB) SSIRepository {
	return &ssiRepository{db: db}
}

func (r *ssiRepository) Create(ssi *domain.SSI) error {
	return r.db.Create(ssi).Error
}

func (r *ssiRepository) FindByID(id string) (*domain.SSI, error) {
	var ssi domain.SSI
	if err := r.db.Preload("Entity").Preload("SettlementCurrency").Preload("Instrument").First(&ssi, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ssi, nil
}

func (r *ssiRepository) FindAll(limit, offset int) ([]*domain.SSI, error) {
	var ssis []*domain.SSI
	if err := r.db.Preload("Entity").Preload("SettlementCurrency").Preload("Instrument").Limit(limit).Offset(offset).Find(&ssis).Error; err != nil {
		return nil, err
	}
	return ssis, nil
}

func (r *ssiRepository) Update(ssi *domain.SSI) error {
	return r.db.Save(ssi).Error
}

func (r *ssiRepository) Delete(id string) error {
	return r.db.Delete(&domain.SSI{}, "id = ?", id).Error
}

// CodeMappingRepository interface
type CodeMappingRepository interface {
	Create(mapping *domain.CodeMapping) error
	FindByID(id string) (*domain.CodeMapping, error)
	FindAll(limit, offset int) ([]*domain.CodeMapping, error)
	FindByFromCode(fromSystem, fromCodeType, fromCode string) ([]*domain.CodeMapping, error)
	Update(mapping *domain.CodeMapping) error
	Delete(id string) error
}

type codeMappingRepository struct {
	db *gorm.DB
}

// NewCodeMappingRepository creates a new code mapping repository
func NewCodeMappingRepository(db *gorm.DB) CodeMappingRepository {
	return &codeMappingRepository{db: db}
}

func (r *codeMappingRepository) Create(mapping *domain.CodeMapping) error {
	return r.db.Create(mapping).Error
}

func (r *codeMappingRepository) FindByID(id string) (*domain.CodeMapping, error) {
	var mapping domain.CodeMapping
	if err := r.db.First(&mapping, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &mapping, nil
}

func (r *codeMappingRepository) FindAll(limit, offset int) ([]*domain.CodeMapping, error) {
	var mappings []*domain.CodeMapping
	if err := r.db.Limit(limit).Offset(offset).Find(&mappings).Error; err != nil {
		return nil, err
	}
	return mappings, nil
}

// FindByFromCode looks up a mapping given the source system, code type, and code value
func (r *codeMappingRepository) FindByFromCode(fromSystem, fromCodeType, fromCode string) ([]*domain.CodeMapping, error) {
	var mappings []*domain.CodeMapping
	if err := r.db.Where(
		"from_system = ? AND from_code_type = ? AND from_code = ? AND active = true",
		fromSystem, fromCodeType, fromCode,
	).Find(&mappings).Error; err != nil {
		return nil, err
	}
	return mappings, nil
}

func (r *codeMappingRepository) Update(mapping *domain.CodeMapping) error {
	return r.db.Save(mapping).Error
}

func (r *codeMappingRepository) Delete(id string) error {
	return r.db.Delete(&domain.CodeMapping{}, "id = ?", id).Error
}

// UserRepository interface
type UserRepository interface {
	Create(user *domain.User) error
	FindByID(id string) (*domain.User, error)
	FindByEmail(email string) (*domain.User, error)
	FindByUsername(username string) (*domain.User, error)
	FindAll(status string, limit, offset int) ([]*domain.User, error)
	Update(user *domain.User) error
	// CountActiveAdmins counts active (non-deleted) users whose role is admin.
	CountActiveAdmins() (int64, error)
}

type userRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(user *domain.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) FindByID(id string) (*domain.User, error) {
	var user domain.User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByEmail(email string) (*domain.User, error) {
	var user domain.User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByUsername(username string) (*domain.User, error) {
	var user domain.User
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindAll(status string, limit, offset int) ([]*domain.User, error) {
	var users []*domain.User
	q := r.db.Order("created_at ASC").Limit(limit).Offset(offset)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *userRepository) Update(user *domain.User) error {
	return r.db.Save(user).Error
}

func (r *userRepository) CountActiveAdmins() (int64, error) {
	var count int64
	err := r.db.Model(&domain.User{}).
		Where("role = ? AND status = ?", domain.UserRoleAdmin, domain.UserStatusActive).
		Count(&count).Error
	return count, err
}

// UserPreferenceRepository interface
type UserPreferenceRepository interface {
	// GetByPage returns all preferences for a user on a given page.
	GetByPage(userID, pageKey string) ([]*domain.UserPreference, error)
	// GetAll returns all preferences for a user across all pages.
	GetAll(userID string) ([]*domain.UserPreference, error)
	// Upsert creates or updates a single preference.
	Upsert(pref *domain.UserPreference) error
	// Delete removes a preference by user, page, and preference key.
	Delete(userID, pageKey, preferenceKey string) error
}

type userPreferenceRepository struct {
	db *gorm.DB
}

// NewUserPreferenceRepository creates a new user preference repository.
func NewUserPreferenceRepository(db *gorm.DB) UserPreferenceRepository {
	return &userPreferenceRepository{db: db}
}

func (r *userPreferenceRepository) GetByPage(userID, pageKey string) ([]*domain.UserPreference, error) {
	var prefs []*domain.UserPreference
	if err := r.db.
		Where("user_id = ? AND page_key = ?", userID, pageKey).
		Find(&prefs).Error; err != nil {
		return nil, err
	}
	return prefs, nil
}

func (r *userPreferenceRepository) GetAll(userID string) ([]*domain.UserPreference, error) {
	var prefs []*domain.UserPreference
	if err := r.db.
		Where("user_id = ?", userID).
		Find(&prefs).Error; err != nil {
		return nil, err
	}
	return prefs, nil
}

func (r *userPreferenceRepository) Upsert(pref *domain.UserPreference) error {
	return r.db.
		Where(domain.UserPreference{
			UserID:        pref.UserID,
			PageKey:       pref.PageKey,
			PreferenceKey: pref.PreferenceKey,
		}).
		Assign(domain.UserPreference{
			PreferenceValue: pref.PreferenceValue,
		}).
		FirstOrCreate(pref).Error
}

func (r *userPreferenceRepository) Delete(userID, pageKey, preferenceKey string) error {
	return r.db.
		Where("user_id = ? AND page_key = ? AND preference_key = ?", userID, pageKey, preferenceKey).
		Delete(&domain.UserPreference{}).Error
}

// UITranslationRepository interface
type UITranslationRepository interface {
	// List returns translations filtered by optional language and status.
	List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error)
	// FindByID returns a single translation by primary key.
	FindByID(id string) (*domain.UITranslation, error)
	// Upsert creates or updates a translation by (translation_key, language_code).
	Upsert(t *domain.UITranslation) error
	// UpdateStatus changes the review status and records the reviewer.
	UpdateStatus(id string, status domain.TranslationStatus, reviewerID string) error
	// Delete removes a translation by primary key.
	Delete(id string) error
}

type uiTranslationRepository struct {
	db *gorm.DB
}

// NewUITranslationRepository creates a new UITranslationRepository.
func NewUITranslationRepository(db *gorm.DB) UITranslationRepository {
	return &uiTranslationRepository{db: db}
}

func (r *uiTranslationRepository) List(languageCode, status, search string, limit, offset int) ([]*domain.UITranslation, int64, error) {
	q := r.db.Model(&domain.UITranslation{})
	if languageCode != "" {
		q = q.Where("language_code = ?", languageCode)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("translation_key ILIKE ? OR translation_value ILIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var results []*domain.UITranslation
	if err := q.Order("translation_key, language_code").Limit(limit).Offset(offset).Find(&results).Error; err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

func (r *uiTranslationRepository) FindByID(id string) (*domain.UITranslation, error) {
	var t domain.UITranslation
	if err := r.db.First(&t, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *uiTranslationRepository) Upsert(t *domain.UITranslation) error {
	return r.db.
		Where(domain.UITranslation{TranslationKey: t.TranslationKey, LanguageCode: t.LanguageCode}).
		Assign(domain.UITranslation{
			TranslationValue: t.TranslationValue,
			Status:           t.Status,
			Notes:            t.Notes,
			SubmittedBy:      t.SubmittedBy,
		}).
		FirstOrCreate(t).Error
}

func (r *uiTranslationRepository) UpdateStatus(id string, status domain.TranslationStatus, reviewerID string) error {
	updates := map[string]interface{}{
		"status":      status,
		"updated_at":  gorm.Expr("NOW()"),
		"reviewed_at": gorm.Expr("NOW()"),
	}
	if reviewerID != "" {
		updates["reviewed_by"] = reviewerID
	}
	return r.db.Model(&domain.UITranslation{}).Where("id = ?", id).Updates(updates).Error
}

func (r *uiTranslationRepository) Delete(id string) error {
	return r.db.Delete(&domain.UITranslation{}, "id = ?", id).Error
}
