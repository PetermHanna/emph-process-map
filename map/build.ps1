# Builds the Process Map control and packages the solution: map\out\EMPHProcessMap.zip
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot 'pcf')
try {
  if (-not (Test-Path node_modules)) { npm install; if ($LASTEXITCODE) { throw 'npm install failed' } }
  node gen-xyflowcss.mjs; if ($LASTEXITCODE) { throw 'gen-xyflowcss failed' }
  npm run build:prod; if ($LASTEXITCODE) { throw 'build failed' }
  node isolate-tabster.mjs; if ($LASTEXITCODE) { throw 'isolate-tabster failed' }
} finally { Pop-Location }
python (Join-Path $PSScriptRoot 'package.py'); if ($LASTEXITCODE) { throw 'package failed' }
node --test (Join-Path $PSScriptRoot 'harness\rules.test.mjs'); if ($LASTEXITCODE) { throw 'tests failed' }
Write-Host 'BUILD OK'
