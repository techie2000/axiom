package version

// Version is the current release version of Axiom.
// This should match the VERSION file in the project root.
// GitCommit and BuildDate are set by the build system via -ldflags.
const Version = "0.3.0"

var (
	GitCommit string = "unknown"
	BuildDate string = "unknown"
)

// GetFullVersion returns the full version string including git commit and build date.
func GetFullVersion() string {
	return Version + " (commit: " + GitCommit + ", built: " + BuildDate + ")"
}
