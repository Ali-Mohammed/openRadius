package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

type RadiusUser struct {
	ID        int
	Username  string
	Password  string
	Firstname string
	Lastname  string
	Enabled   bool
	IsDeleted bool
}

func ConnectDB(config *Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		config.DBHost,
		config.DBPort,
		config.DBUser,
		config.DBPassword,
		config.DBName,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("✓ Connected to database: %s", config.DBName)
	return db, nil
}

func FetchActiveUsers(db *sql.DB, limit int) ([]RadiusUser, error) {
	query := `
		SELECT "Id", "Username", "Password", "Firstname", "Lastname", "Enabled", "IsDeleted"
		FROM "RadiusUsers"
		WHERE "IsDeleted" = false 
		  AND "Enabled" = true
		  AND "Password" IS NOT NULL
		  AND "Password" != ''
		  AND ("Expiration" IS NULL OR "Expiration" > NOW())
		ORDER BY "Id"
		LIMIT $1
	`

	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []RadiusUser
	for rows.Next() {
		var user RadiusUser
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Password,
			&user.Firstname,
			&user.Lastname,
			&user.Enabled,
			&user.IsDeleted,
		)
		if err != nil {
			log.Printf("Warning: Failed to scan user: %v", err)
			continue
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	log.Printf("✓ Fetched %d active users from database", len(users))
	return users, nil
}
