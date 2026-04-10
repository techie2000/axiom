package repository

import (
	"github.com/techie2000/axiom/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GLEIFRegistrationAuthorityRepository defines data access for GLEIF registration authorities.
type GLEIFRegistrationAuthorityRepository interface {
	Upsert(records []*domain.GLEIFRegistrationAuthority) error
	Count() (int64, error)
	FindAll(limit, offset int) ([]*domain.GLEIFRegistrationAuthority, error)
	FindByRAID(raID string) (*domain.GLEIFRegistrationAuthority, error)
	DeactivateAll() error
}

type gleifRegistrationAuthorityRepository struct {
	db *gorm.DB
}

// NewGLEIFRegistrationAuthorityRepository creates a new GLEIFRegistrationAuthorityRepository.
func NewGLEIFRegistrationAuthorityRepository(db *gorm.DB) GLEIFRegistrationAuthorityRepository {
	return &gleifRegistrationAuthorityRepository{db: db}
}

func (r *gleifRegistrationAuthorityRepository) Upsert(records []*domain.GLEIFRegistrationAuthority) error {
	if len(records) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "ra_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"organization_name", "jurisdiction", "international_name",
			"languages_used", "website", "comments", "active", "updated_by", "updated_at",
		}),
	}).Create(records).Error
}

func (r *gleifRegistrationAuthorityRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&domain.GLEIFRegistrationAuthority{}).Count(&count).Error
	return count, err
}

func (r *gleifRegistrationAuthorityRepository) FindAll(limit, offset int) ([]*domain.GLEIFRegistrationAuthority, error) {
	var records []*domain.GLEIFRegistrationAuthority
	err := r.db.Limit(limit).Offset(offset).
		Order("ra_id ASC").
		Find(&records).Error
	return records, err
}

func (r *gleifRegistrationAuthorityRepository) FindByRAID(raID string) (*domain.GLEIFRegistrationAuthority, error) {
	var record domain.GLEIFRegistrationAuthority
	err := r.db.Where("ra_id = ?", raID).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *gleifRegistrationAuthorityRepository) DeactivateAll() error {
	return r.db.Model(&domain.GLEIFRegistrationAuthority{}).
		Where("active = TRUE").
		Update("active", false).Error
}

// GLEIFEntityLegalFormRepository defines data access for GLEIF entity legal forms.
type GLEIFEntityLegalFormRepository interface {
	Upsert(records []*domain.GLEIFEntityLegalForm) error
	Count() (int64, error)
	FindAll(limit, offset int) ([]*domain.GLEIFEntityLegalForm, error)
	FindByELFCode(elfCode string) (*domain.GLEIFEntityLegalForm, error)
	DeactivateAll() error
}

type gleifEntityLegalFormRepository struct {
	db *gorm.DB
}

// NewGLEIFEntityLegalFormRepository creates a new GLEIFEntityLegalFormRepository.
func NewGLEIFEntityLegalFormRepository(db *gorm.DB) GLEIFEntityLegalFormRepository {
	return &gleifEntityLegalFormRepository{db: db}
}

func (r *gleifEntityLegalFormRepository) Upsert(records []*domain.GLEIFEntityLegalForm) error {
	if len(records) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "elf_code"},
			{Name: "language_code"},
			{Name: "country_of_formation"},
			{Name: "country_subdivision_of_formation"},
			{Name: "entity_legal_form_name"},
			{Name: "status"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"abbreviations", "updated_by", "updated_at",
		}),
	}).Create(records).Error
}

func (r *gleifEntityLegalFormRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&domain.GLEIFEntityLegalForm{}).Count(&count).Error
	return count, err
}

func (r *gleifEntityLegalFormRepository) FindAll(limit, offset int) ([]*domain.GLEIFEntityLegalForm, error) {
	var records []*domain.GLEIFEntityLegalForm
	err := r.db.Limit(limit).Offset(offset).
		Order("elf_code ASC").
		Find(&records).Error
	return records, err
}

func (r *gleifEntityLegalFormRepository) FindByELFCode(elfCode string) (*domain.GLEIFEntityLegalForm, error) {
	var record domain.GLEIFEntityLegalForm
	err := r.db.Where("elf_code = ?", elfCode).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *gleifEntityLegalFormRepository) DeactivateAll() error {
	return r.db.Model(&domain.GLEIFEntityLegalForm{}).
		Where("status = ?", "ACTIVE").
		Update("status", "DECOMMISSIONED").Error
}

// GLEIFOrganizationalRoleRepository defines data access for GLEIF organizational roles.
type GLEIFOrganizationalRoleRepository interface {
	Upsert(records []*domain.GLEIFOrganizationalRole) error
	Count() (int64, error)
	FindAll(limit, offset int) ([]*domain.GLEIFOrganizationalRole, error)
	FindByRoleCode(roleCode string) (*domain.GLEIFOrganizationalRole, error)
	DeactivateAll() error
}

type gleifOrganizationalRoleRepository struct {
	db *gorm.DB
}

// NewGLEIFOrganizationalRoleRepository creates a new GLEIFOrganizationalRoleRepository.
func NewGLEIFOrganizationalRoleRepository(db *gorm.DB) GLEIFOrganizationalRoleRepository {
	return &gleifOrganizationalRoleRepository{db: db}
}

func (r *gleifOrganizationalRoleRepository) Upsert(records []*domain.GLEIFOrganizationalRole) error {
	if len(records) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "role_code"},
			{Name: "language_code"},
			{Name: "country_of_formation"},
			{Name: "country_subdivision_of_formation"},
			{Name: "elf_code"},
			{Name: "role_name"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"description", "active", "updated_by", "updated_at",
		}),
	}).Create(records).Error
}

func (r *gleifOrganizationalRoleRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&domain.GLEIFOrganizationalRole{}).Count(&count).Error
	return count, err
}

func (r *gleifOrganizationalRoleRepository) FindAll(limit, offset int) ([]*domain.GLEIFOrganizationalRole, error) {
	var records []*domain.GLEIFOrganizationalRole
	err := r.db.Limit(limit).Offset(offset).
		Order("role_code ASC").
		Find(&records).Error
	return records, err
}

func (r *gleifOrganizationalRoleRepository) FindByRoleCode(roleCode string) (*domain.GLEIFOrganizationalRole, error) {
	var record domain.GLEIFOrganizationalRole
	err := r.db.Where("role_code = ?", roleCode).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *gleifOrganizationalRoleRepository) DeactivateAll() error {
	return r.db.Model(&domain.GLEIFOrganizationalRole{}).
		Where("active = TRUE").
		Update("active", false).Error
}

// GLEIFLegalJurisdictionRepository defines data access for GLEIF legal jurisdictions.
type GLEIFLegalJurisdictionRepository interface {
	Upsert(records []*domain.GLEIFLegalJurisdiction) error
	Count() (int64, error)
	FindAll(limit, offset int) ([]*domain.GLEIFLegalJurisdiction, error)
	FindByCode(jurisdictionCode string) (*domain.GLEIFLegalJurisdiction, error)
	DeactivateAll() error
}

type gleifLegalJurisdictionRepository struct {
	db *gorm.DB
}

// NewGLEIFLegalJurisdictionRepository creates a new GLEIFLegalJurisdictionRepository.
func NewGLEIFLegalJurisdictionRepository(db *gorm.DB) GLEIFLegalJurisdictionRepository {
	return &gleifLegalJurisdictionRepository{db: db}
}

func (r *gleifLegalJurisdictionRepository) Upsert(records []*domain.GLEIFLegalJurisdiction) error {
	if len(records) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "jurisdiction_code"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"jurisdiction_name", "country_code", "active", "updated_by", "updated_at",
		}),
	}).Create(records).Error
}

func (r *gleifLegalJurisdictionRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&domain.GLEIFLegalJurisdiction{}).Count(&count).Error
	return count, err
}

func (r *gleifLegalJurisdictionRepository) FindAll(limit, offset int) ([]*domain.GLEIFLegalJurisdiction, error) {
	var records []*domain.GLEIFLegalJurisdiction
	err := r.db.Limit(limit).Offset(offset).
		Order("jurisdiction_code ASC").
		Find(&records).Error
	return records, err
}

func (r *gleifLegalJurisdictionRepository) FindByCode(jurisdictionCode string) (*domain.GLEIFLegalJurisdiction, error) {
	var record domain.GLEIFLegalJurisdiction
	err := r.db.Where("jurisdiction_code = ?", jurisdictionCode).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *gleifLegalJurisdictionRepository) DeactivateAll() error {
	return r.db.Model(&domain.GLEIFLegalJurisdiction{}).
		Where("active = TRUE").
		Update("active", false).Error
}
