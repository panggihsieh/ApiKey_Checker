$ErrorActionPreference = "Stop"

$cppRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $cppRoot "..")
$dist = Join-Path $cppRoot "dist"
$generated = Join-Path $cppRoot "generated"
$build = Join-Path $cppRoot "build"
$version = (Get-Content -Raw (Join-Path $repoRoot "package.json") | ConvertFrom-Json).version
$output = Join-Path $dist "API-Key-Checker-$version-cpp-windows-x64-portable.exe"
$object = Join-Path $build "main.obj"

New-Item -ItemType Directory -Force $dist | Out-Null
New-Item -ItemType Directory -Force $generated | Out-Null
New-Item -ItemType Directory -Force $build | Out-Null

node (Join-Path $cppRoot "tools\generate-assets.js") $repoRoot (Join-Path $generated "assets.hpp")

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) {
  throw "Visual Studio C++ Build Tools were not found."
}

$devcmd = Join-Path $vs "Common7\Tools\VsDevCmd.bat"
$source = Join-Path $cppRoot "src\main.cpp"
$include = $generated
$cmd = "`"$devcmd`" -arch=x64 && cl /nologo /std:c++17 /EHsc /O2 /MT /DWIN32_LEAN_AND_MEAN /I `"$include`" `"$source`" /Fo:`"$object`" /Fe:`"$output`" ws2_32.lib advapi32.lib shell32.lib bcrypt.lib user32.lib"

cmd /c $cmd
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Built $output"
