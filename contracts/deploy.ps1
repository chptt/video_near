# ============================================================
# PrivateStream NEAR - Contract Deployment Script
# Account: chandanapt.testnet
# Contract: privatestream.chandanapt.testnet
# ============================================================
# Run this script AFTER completing: near login --networkId testnet
# Usage: .\contracts\deploy.ps1
# ============================================================

$env:PATH = "C:\Users\Chandana\AppData\Roaming\npm;" + $env:PATH

$MASTER_ACCOUNT = "chandanapt.testnet"
$CONTRACT_ACCOUNT = "privatestream.chandanapt.testnet"
$NETWORK = "testnet"
$CONTRACT_JS = "contracts/private_stream_near.js"
$CONTRACT_WASM = "contracts/private_stream_near.wasm"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PrivateStream NEAR - Contract Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check credentials
Write-Host "[1/5] Checking NEAR credentials..." -ForegroundColor Yellow
$credPath = "$env:USERPROFILE\.near-credentials\testnet\$MASTER_ACCOUNT.json"
if (-not (Test-Path $credPath)) {
    Write-Host "ERROR: No credentials found for $MASTER_ACCOUNT" -ForegroundColor Red
    Write-Host "Please run: near login --networkId testnet" -ForegroundColor Red
    exit 1
}
Write-Host "      Credentials found for $MASTER_ACCOUNT" -ForegroundColor Green

# Step 2: Check master account balance
Write-Host "[2/5] Checking account balance..." -ForegroundColor Yellow
near state $MASTER_ACCOUNT --networkId $NETWORK 2>&1 | Select-String "amount"

# Step 3: Create contract sub-account
Write-Host "[3/5] Creating contract sub-account: $CONTRACT_ACCOUNT" -ForegroundColor Yellow
$subExists = near state $CONTRACT_ACCOUNT --networkId $NETWORK 2>&1
if ($subExists -match "does not exist") {
    near create-account $CONTRACT_ACCOUNT `
        --masterAccount $MASTER_ACCOUNT `
        --initialBalance 10 `
        --networkId $NETWORK
    Write-Host "      Sub-account created with 10 NEAR" -ForegroundColor Green
} else {
    Write-Host "      Sub-account already exists, skipping" -ForegroundColor Yellow
}

# Step 4: Build contract
Write-Host "[4/5] Building contract JS -> WASM..." -ForegroundColor Yellow
npx near-sdk-js build $CONTRACT_JS --out $CONTRACT_WASM
if (-not (Test-Path $CONTRACT_WASM)) {
    Write-Host "ERROR: WASM build failed" -ForegroundColor Red
    exit 1
}
Write-Host "      Contract built: $CONTRACT_WASM" -ForegroundColor Green

# Step 5: Deploy
Write-Host "[5/5] Deploying to $CONTRACT_ACCOUNT..." -ForegroundColor Yellow
near deploy `
    --accountId $CONTRACT_ACCOUNT `
    --wasmFile $CONTRACT_WASM `
    --networkId $NETWORK

# Step 6: Initialize
Write-Host "[6/6] Initializing contract..." -ForegroundColor Yellow
near call $CONTRACT_ACCOUNT init `
    "{`"treasuryAccount`":`"$MASTER_ACCOUNT`",`"nearPriceCents`":500}" `
    --accountId $MASTER_ACCOUNT `
    --networkId $NETWORK

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Contract Address: $CONTRACT_ACCOUNT" -ForegroundColor Cyan
Write-Host "Explorer: https://testnet.nearblocks.io/address/$CONTRACT_ACCOUNT" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add to .env.vercel:" -ForegroundColor Yellow
Write-Host "NEXT_PUBLIC_CONTRACT_NAME=$CONTRACT_ACCOUNT" -ForegroundColor White
Write-Host ""

# Step 7: Verify
Write-Host "Verifying deployment..." -ForegroundColor Yellow
near view $CONTRACT_ACCOUNT get_stats '{}' --networkId $NETWORK
