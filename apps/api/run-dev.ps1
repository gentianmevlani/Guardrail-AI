# Load environment variables from .env file and set them for the process
$envVars = @{}
Get-Content .env | ForEach-Object {
    if ($_ -and !$_.StartsWith('#') -and $_.Contains('=')) {
        $key, $value = $_.Split('=', 2)
        $key = $key.Trim()
        $value = $value.Trim().Trim('"')
        Set-Item -Path "env:$key" -Value $value
        $envVars[$key] = $value
    }
}

Write-Host "Environment variables loaded:"
$envVars.Keys | ForEach-Object { Write-Host "  $_=$($envVars[$_])" }

# Run the API
npx tsx src/index.ts
