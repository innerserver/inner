$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$publishDir = Join-Path $root "dist\Inner"
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$exe = Join-Path $publishDir "Inner.exe"

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

if (Test-Path $csc) {
  & $csc `
    /nologo `
    /target:winexe `
    /platform:x64 `
    "/out:$exe" `
    /reference:System.dll `
    /reference:System.Drawing.dll `
    /reference:System.Windows.Forms.dll `
    (Join-Path $PSScriptRoot "Program.cs")
  if ($LASTEXITCODE -ne 0) {
    throw "C# compiler failed with exit code $LASTEXITCODE"
  }
} else {
  dotnet publish (Join-Path $PSScriptRoot "Inner.Desktop.csproj") `
    -c Release `
    -r win-x64 `
    --self-contained false `
    -p:PublishSingleFile=true `
    -p:PublishReadyToRun=false `
    -o $publishDir
}

Copy-Item (Join-Path $root "server.js") $publishDir -Force
Copy-Item (Join-Path $root "package.json") $publishDir -Force
Copy-Item (Join-Path $root "README.md") $publishDir -Force
Copy-Item (Join-Path $root "START-HERE.txt") $publishDir -Force
Copy-Item (Join-Path $root "public") $publishDir -Recurse -Force

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Copy-Item $node.Source (Join-Path $publishDir "node.exe") -Force
}

New-Item -ItemType Directory -Force -Path (Join-Path $publishDir "data") | Out-Null

Write-Host "Built Inner desktop app:"
Write-Host $exe
