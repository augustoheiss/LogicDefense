param(
    [Parameter(Mandatory = $true)][string]$InputDir,
    [Parameter(Mandatory = $true)][string]$OutputJson
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Media.Ocr, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Wait-WinRt {
    param($WinRtTask, [Type]$ResultType)
    $netTask = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

$lang = New-Object Windows.Globalization.Language('pt-BR')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) {
    throw 'Falha ao inicializar OcrEngine para pt-BR'
}

$absInput = (Resolve-Path $InputDir).Path
$files = Get-ChildItem -Path $absInput -Filter '*.png' | Sort-Object Name
$results = [ordered]@{}

foreach ($f in $files) {
    $storageFile = Wait-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Wait-WinRt ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
        $decoder = Wait-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bmp = Wait-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $ocrRes = Wait-WinRt ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
            $linhas = @($ocrRes.Lines | ForEach-Object { $_.Text })
            $results[$f.Name] = ($linhas -join "`n")
        } finally {
            $bmp.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

$outParent = Split-Path -Parent $OutputJson
if ($outParent -and -not (Test-Path $outParent)) {
    New-Item -ItemType Directory -Path $outParent -Force | Out-Null
}
$jsonText = $results | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($OutputJson, $jsonText, [System.Text.UTF8Encoding]::new($false))
Write-Output ("ocr_winrt: processados " + $files.Count + " recortes PNG -> " + $OutputJson)
