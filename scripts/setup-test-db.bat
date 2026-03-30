@echo off
echo 🚀 Setting up test database for GUARDRAIL...

REM Start the test database
echo Starting PostgreSQL test database...
docker-compose -f docker-compose.test.yml up -d

REM Wait for the database to be ready
echo Waiting for database to be ready...
timeout /t 5 /nobreak

REM Run database migrations
echo Running database migrations...
set DATABASE_URL=postgresql://postgres:postgres@localhost:5433/GUARDRAIL_test
npx prisma migrate deploy

REM Seed test data if needed
echo Seeding test data...
npx prisma db seed

echo ✅ Test database is ready!
echo Database URL: postgresql://postgres:postgres@localhost:5433/GUARDRAIL_test
echo.
echo To run integration tests:
echo DATABASE_URL="postgresql://postgres:postgres@localhost:5433/GUARDRAIL_test" npm run test:integration
echo.
echo To stop the test database:
echo docker-compose -f docker-compose.test.yml down
