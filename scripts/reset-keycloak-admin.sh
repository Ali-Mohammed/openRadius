#!/bin/bash

echo "🔑 Resetting Keycloak admin password..."
echo ""

# Try to set new password
docker exec openradius-postgres psql -U admin -d keycloak <<EOF
-- Reset admin password to 'admin123'
-- Password hash for 'admin123' (you should change this after login!)
UPDATE credential 
SET credential_data = '{"value":"kTvCHH+NOjJvQJKR3pn5cJPINSYqrVYlV8jOG6qrXBk=","salt":"XvuBPKtPzMI9BdMeHJDY4A==","additionalParameters":{}}',
    secret_data = '{"value":"kTvCHH+NOjJvQJKR3pn5cJPINSYqrVYlV8jOG6qrXBk=","salt":"XvuBPKtPzMI9BdMeHJDY4A==","additionalParameters":{}}'
WHERE user_id IN (
  SELECT id FROM user_entity WHERE username='admin' AND realm_id='master'
) AND type='password';
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Password reset successful!"
  echo ""
  echo "📋 New credentials:"
  echo "   URL:      http://localhost:8080"
  echo "   Username: admin"
  echo "   Password: admin123"
  echo ""
  echo "⚠️  Please change this password after logging in!"
else
  echo ""
  echo "❌ Failed to reset password"
fi
