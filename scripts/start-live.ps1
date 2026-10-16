$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$previousToken = $env:MCD_MCP_TOKEN
$secureToken = Read-Host '请输入麦当劳 MCP Token（隐藏输入，不保存）' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $env:MCD_MCP_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    Write-Host '凭证仅用于本机进程。请打开终端显示的本机网址。'
    & node server.mjs
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $env:MCD_MCP_TOKEN = $previousToken
    $secureToken.Dispose()
}
