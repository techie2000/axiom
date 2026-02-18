package service

import (
	"github.com/techie2000/axiom/internal/domain"
	"github.com/techie2000/axiom/internal/repository"
	"gorm.io/gorm"
)

// Services holds all service interfaces
type Services struct {
	Country    CountryService
	Currency   CurrencyService
	Entity     EntityService
	Instrument InstrumentService
	Account    AccountService
	SSI        SSIService
	LEI        LEIService
	MasterData MasterDataService
}

// NewServices creates a new services instance
func NewServices(repos *repository.Repositories, db *gorm.DB, leiDataDir string, masterDataDir string) *Services {
	return &Services{
		Country:    NewCountryService(repos.Country),
		Currency:   NewCurrencyService(repos.Currency),
		Entity:     NewEntityService(repos.Entity),
		Instrument: NewInstrumentService(repos.Instrument),
		Account:    NewAccountService(repos.Account),
		SSI:        NewSSIService(repos.SSI),
		LEI:        NewLEIService(repos.LEI, repos.Country, leiDataDir),
		MasterData: NewMasterDataService(db, masterDataDir),
	}
}

// CountryService interface
type CountryService interface {
	Create(country *domain.Country) error
	GetByID(id string) (*domain.Country, error)
	GetAll(limit, offset int) ([]*domain.Country, error)
	Update(country *domain.Country) error
	Delete(id string) error
}

type countryService struct {
	repo repository.CountryRepository
}

func NewCountryService(repo repository.CountryRepository) CountryService {
	return &countryService{repo: repo}
}

func (s *countryService) Create(country *domain.Country) error {
	return s.repo.Create(country)
}

func (s *countryService) GetByID(id string) (*domain.Country, error) {
	return s.repo.FindByID(id)
}

func (s *countryService) GetAll(limit, offset int) ([]*domain.Country, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *countryService) Update(country *domain.Country) error {
	return s.repo.Update(country)
}

func (s *countryService) Delete(id string) error {
	return s.repo.Delete(id)
}

// Similar implementations for other services
type CurrencyService interface {
	Create(currency *domain.Currency) error
	GetByID(id string) (*domain.Currency, error)
	GetAll(limit, offset int) ([]*domain.Currency, error)
	Update(currency *domain.Currency) error
	Delete(id string) error
}

type currencyService struct {
	repo repository.CurrencyRepository
}

func NewCurrencyService(repo repository.CurrencyRepository) CurrencyService {
	return &currencyService{repo: repo}
}

func (s *currencyService) Create(currency *domain.Currency) error {
	return s.repo.Create(currency)
}

func (s *currencyService) GetByID(id string) (*domain.Currency, error) {
	return s.repo.FindByID(id)
}

func (s *currencyService) GetAll(limit, offset int) ([]*domain.Currency, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *currencyService) Update(currency *domain.Currency) error {
	return s.repo.Update(currency)
}

func (s *currencyService) Delete(id string) error {
	return s.repo.Delete(id)
}

// EntityService, InstrumentService, AccountService, SSIService follow the same pattern
type EntityService interface {
	Create(entity *domain.Entity) error
	GetByID(id string) (*domain.Entity, error)
	GetAll(limit, offset int) ([]*domain.Entity, error)
	Update(entity *domain.Entity) error
	Delete(id string) error
}

type entityService struct {
	repo repository.EntityRepository
}

func NewEntityService(repo repository.EntityRepository) EntityService {
	return &entityService{repo: repo}
}

func (s *entityService) Create(entity *domain.Entity) error {
	return s.repo.Create(entity)
}

func (s *entityService) GetByID(id string) (*domain.Entity, error) {
	return s.repo.FindByID(id)
}

func (s *entityService) GetAll(limit, offset int) ([]*domain.Entity, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *entityService) Update(entity *domain.Entity) error {
	return s.repo.Update(entity)
}

func (s *entityService) Delete(id string) error {
	return s.repo.Delete(id)
}

type InstrumentService interface {
	Create(instrument *domain.Instrument) error
	GetByID(id string) (*domain.Instrument, error)
	GetAll(limit, offset int) ([]*domain.Instrument, error)
	Update(instrument *domain.Instrument) error
	Delete(id string) error
}

type instrumentService struct {
	repo repository.InstrumentRepository
}

func NewInstrumentService(repo repository.InstrumentRepository) InstrumentService {
	return &instrumentService{repo: repo}
}

func (s *instrumentService) Create(instrument *domain.Instrument) error {
	return s.repo.Create(instrument)
}

func (s *instrumentService) GetByID(id string) (*domain.Instrument, error) {
	return s.repo.FindByID(id)
}

func (s *instrumentService) GetAll(limit, offset int) ([]*domain.Instrument, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *instrumentService) Update(instrument *domain.Instrument) error {
	return s.repo.Update(instrument)
}

func (s *instrumentService) Delete(id string) error {
	return s.repo.Delete(id)
}

type AccountService interface {
	Create(account *domain.Account) error
	GetByID(id string) (*domain.Account, error)
	GetAll(limit, offset int) ([]*domain.Account, error)
	Update(account *domain.Account) error
	Delete(id string) error
}

type accountService struct {
	repo repository.AccountRepository
}

func NewAccountService(repo repository.AccountRepository) AccountService {
	return &accountService{repo: repo}
}

func (s *accountService) Create(account *domain.Account) error {
	return s.repo.Create(account)
}

func (s *accountService) GetByID(id string) (*domain.Account, error) {
	return s.repo.FindByID(id)
}

func (s *accountService) GetAll(limit, offset int) ([]*domain.Account, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *accountService) Update(account *domain.Account) error {
	return s.repo.Update(account)
}

func (s *accountService) Delete(id string) error {
	return s.repo.Delete(id)
}

type SSIService interface {
	Create(ssi *domain.SSI) error
	GetByID(id string) (*domain.SSI, error)
	GetAll(limit, offset int) ([]*domain.SSI, error)
	Update(ssi *domain.SSI) error
	Delete(id string) error
}

type ssiService struct {
	repo repository.SSIRepository
}

func NewSSIService(repo repository.SSIRepository) SSIService {
	return &ssiService{repo: repo}
}

func (s *ssiService) Create(ssi *domain.SSI) error {
	return s.repo.Create(ssi)
}

func (s *ssiService) GetByID(id string) (*domain.SSI, error) {
	return s.repo.FindByID(id)
}

func (s *ssiService) GetAll(limit, offset int) ([]*domain.SSI, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *ssiService) Update(ssi *domain.SSI) error {
	return s.repo.Update(ssi)
}

func (s *ssiService) Delete(id string) error {
	return s.repo.Delete(id)
}
