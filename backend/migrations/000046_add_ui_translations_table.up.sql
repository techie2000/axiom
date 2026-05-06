CREATE TABLE IF NOT EXISTS ui_translations (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    translation_key VARCHAR(500) NOT NULL,
    language_code VARCHAR(10) NOT NULL REFERENCES languages (code) ON DELETE CASCADE, -- noqa: RF04
    translation_value TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    submitted_by UUID REFERENCES users (id) ON DELETE SET NULL, -- noqa: RF04
    reviewed_by UUID REFERENCES users (id) ON DELETE SET NULL, -- noqa: RF04
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ui_translations_key_language UNIQUE (translation_key, language_code)
);

CREATE INDEX IF NOT EXISTS idx_ui_translations_key ON ui_translations (translation_key);
CREATE INDEX IF NOT EXISTS idx_ui_translations_language ON ui_translations (language_code);
CREATE INDEX IF NOT EXISTS idx_ui_translations_status ON ui_translations (status);

COMMENT ON TABLE ui_translations IS
'Stores community-contributed UI translation strings that go through a review
workflow before being shipped.  Approved translations are exported as locale
JSON files and loaded by i18next.  Pending and rejected translations are only
visible in the admin translation management UI.';

COMMENT ON COLUMN ui_translations.id IS 'Surrogate primary key (UUID v4).';
COMMENT ON COLUMN ui_translations.translation_key IS
'Dot-separated i18next key path matching the JSON locale file structure
(e.g. ''login.title'', ''common.save'', ''register.errorPasswordMatch'').';
COMMENT ON COLUMN ui_translations.language_code IS
'ISO 639-1 two-letter language code referencing the languages table
(e.g. ''en'', ''fr'', ''es'', ''de'', ''ja'', ''ar'').';
COMMENT ON COLUMN ui_translations.translation_value IS
'The translated text for this key in this language.';
COMMENT ON COLUMN ui_translations.status IS
'Review lifecycle state: pending (submitted, awaiting review),
approved (accepted and eligible for export), rejected (declined).';
COMMENT ON COLUMN ui_translations.notes IS
'Optional context or reviewer notes describing the translation or reasons
for rejection.';
COMMENT ON COLUMN ui_translations.submitted_by IS
'User who submitted this translation for review.';
COMMENT ON COLUMN ui_translations.reviewed_by IS
'Admin who approved or rejected this translation.  NULL until reviewed.';
COMMENT ON COLUMN ui_translations.reviewed_at IS
'Timestamp when the translation was approved or rejected.  NULL until reviewed.';
COMMENT ON COLUMN ui_translations.created_at IS 'Timestamp when the translation was submitted.';
COMMENT ON COLUMN ui_translations.updated_at IS 'Timestamp of the most recent change to this row.';

-- Ensure required language reference records exist before FK-backed seed inserts.
INSERT INTO languages (code, language_name, native_name, rtl)
VALUES
('en', 'English', 'English', FALSE),
('fr', 'French', 'Français', FALSE),
('es', 'Spanish', 'Español', FALSE),
('de', 'German', 'Deutsch', FALSE),
('ja', 'Japanese', '日本語', FALSE),
('ar', 'Arabic', 'العربية', TRUE),
('zh', 'Chinese', '中文', FALSE),
('it', 'Italian', 'Italiano', FALSE),
('pt', 'Portuguese', 'Português', FALSE),
('nl', 'Dutch', 'Nederlands', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ui_translations (translation_key, language_code, translation_value, status)
VALUES
('login.title', 'fr', 'Connexion', 'approved'),
('login.subtitle', 'fr', 'Connectez-vous pour accéder aux fonctionnalités protégées d''Axiom', 'approved'),
('login.emailLabel', 'fr', 'Adresse e-mail', 'approved'),
('login.submitButton', 'fr', 'Se connecter', 'approved'),
('register.title', 'fr', 'Demander l''accès', 'approved'),
('register.submitButton', 'fr', 'Soumettre la demande', 'approved'),
('login.title', 'es', 'Iniciar sesión', 'approved'),
('login.submitButton', 'es', 'Iniciar sesión', 'approved'),
('register.title', 'es', 'Solicitar acceso', 'approved'),
('login.title', 'de', 'Anmelden', 'approved'),
('login.submitButton', 'de', 'Anmelden', 'approved'),
('register.title', 'de', 'Zugang beantragen', 'approved'),
('login.title', 'ja', 'サインイン', 'approved'),
('login.submitButton', 'ja', 'サインイン', 'approved'),
('register.title', 'ja', 'アクセスを申請', 'approved'),
('login.title', 'ar', 'تسجيل الدخول', 'approved'),
('login.submitButton', 'ar', 'تسجيل الدخول', 'approved'),
('register.title', 'ar', 'طلب الوصول', 'approved'),
('login.title', 'zh', '登录', 'approved'),
('login.submitButton', 'zh', '登录', 'approved'),
('register.title', 'zh', '申请访问', 'approved'),
('login.title', 'it', 'Accedi', 'approved'),
('login.submitButton', 'it', 'Accedi', 'approved'),
('register.title', 'it', 'Richiedi accesso', 'approved'),
('login.title', 'pt', 'Entrar', 'approved'),
('login.submitButton', 'pt', 'Entrar', 'approved'),
('register.title', 'pt', 'Solicitar acesso', 'approved'),
('login.title', 'nl', 'Inloggen', 'approved'),
('login.submitButton', 'nl', 'Inloggen', 'approved'),
('register.title', 'nl', 'Toegang aanvragen', 'approved')
ON CONFLICT (translation_key, language_code) DO NOTHING;
