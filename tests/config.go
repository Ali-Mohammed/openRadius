package main

import (
	"os"
)

type Config struct {
	// Database Config
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string

	// RADIUS Config
	RadiusServer   string
	RadiusAuthPort string
	RadiusAcctPort string
	RadiusSecret   string
	NASIPAddress   string
	NASPortID      string
}

func LoadConfig() *Config {
	return &Config{
		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBName:     getEnv("DB_NAME", "openradius_workspace_1"),
		DBUser:     getEnv("DB_USER", "admin"),
		DBPassword: getEnv("DB_PASSWORD", "admin123"),

		// RADIUS
		RadiusServer:   getEnv("RADIUS_SERVER", "localhost"),
		RadiusAuthPort: getEnv("RADIUS_AUTH_PORT", "1812"),
		RadiusAcctPort: getEnv("RADIUS_ACCT_PORT", "1813"),
		RadiusSecret:   getEnv("RADIUS_SECRET", "testing123"),
		NASIPAddress:   getEnv("NAS_IP_ADDRESS", "192.168.1.10"),
		NASPortID:      getEnv("NAS_PORT_ID", "eth1"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
