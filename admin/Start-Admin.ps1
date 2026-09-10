param([switch]$ValidateOnly, [switch]$ValidateRefresh)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$script:job = $null
$script:jobKind = ''
$script:outFile = ''
$script:errFile = ''
$script:refreshValidated = $false

$form = New-Object System.Windows.Forms.Form
$form.Text = 'BalkanGuess Admin'
$form.Size = New-Object System.Drawing.Size(1180, 800)
$form.MinimumSize = New-Object System.Drawing.Size(900, 650)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.BackColor = [System.Drawing.Color]::FromArgb(242,244,247)

$layout = New-Object System.Windows.Forms.TableLayoutPanel
$layout.Dock = 'Fill'
$layout.RowCount = 4
$layout.ColumnCount = 1
$layout.Padding = New-Object System.Windows.Forms.Padding(18)
foreach ($height in @(54,70,46)) { [void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', $height))) }
[void]$layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Percent', 100)))
$form.Controls.Add($layout)
$title = New-Object System.Windows.Forms.Label
$title.Text = 'BalkanGuess / Admin workspace'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$title.Dock = 'Fill'
$layout.Controls.Add($title,0,0)

$toolbar = New-Object System.Windows.Forms.FlowLayoutPanel
$toolbar.Dock = 'Fill'
$target = New-Object System.Windows.Forms.ComboBox
$target.DropDownStyle = 'DropDownList'
$target.Width = 245
[void]$target.Items.Add('Local catalog (this computer)')
[void]$target.Items.Add('Live R2 catalog (publishes clips)')
$target.SelectedIndex = 0
$daysLabel = New-Object System.Windows.Forms.Label
$daysLabel.Text = 'Days ahead:'
$daysLabel.AutoSize = $true
$daysLabel.Padding = New-Object System.Windows.Forms.Padding(8,6,0,0)
$days = New-Object System.Windows.Forms.NumericUpDown
$days.Minimum = 1
$days.Maximum = 30
$days.Value = 7
$days.Width = 55
$refresh = New-Object System.Windows.Forms.Button
$refresh.Text = 'Refresh dashboard'
$refresh.Size = New-Object System.Drawing.Size(165,34)
$prepare = New-Object System.Windows.Forms.Button
$prepare.Text = 'Prepare local songs'
$prepare.Size = New-Object System.Drawing.Size(210,34)
$toolbar.Controls.AddRange(@($target,$daysLabel,$days,$refresh,$prepare))
$layout.Controls.Add($toolbar,0,1)
$status = New-Object System.Windows.Forms.Label
$status.Dock = 'Fill'
$status.Text = 'Ready. Community stats use the database configured in .env.'
$layout.Controls.Add($status,0,2)
$tabs = New-Object System.Windows.Forms.TabControl
$tabs.Dock = 'Fill'
$layout.Controls.Add($tabs,0,3)

function New-GridTab($name) {
  $page = New-Object System.Windows.Forms.TabPage
  $page.Text = $name
  $grid = New-Object System.Windows.Forms.DataGridView
  $grid.Dock = 'Fill'
  $grid.ReadOnly = $true
  $grid.AllowUserToAddRows = $false
  $grid.AllowUserToDeleteRows = $false
  $grid.AutoSizeColumnsMode = 'AllCells'
  $grid.RowHeadersVisible = $false
  $grid.BackgroundColor = [System.Drawing.Color]::White
  $page.Controls.Add($grid)
  [void]$tabs.TabPages.Add($page)
  return $grid
}
$healthGrid = New-GridTab 'Upcoming songs & clip health'
$communityGrid = New-GridTab 'Community / last 30 days'
$toolsGrid = New-GridTab 'Preparation tools'
$logPage = New-Object System.Windows.Forms.TabPage
$logPage.Text = 'Preparation log'
$log = New-Object System.Windows.Forms.TextBox
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = 'Both'
$log.WordWrap = $false
$log.Dock = 'Fill'
$log.Font = New-Object System.Drawing.Font('Consolas',10)
$logPage.Controls.Add($log)
[void]$tabs.TabPages.Add($logPage)

function Set-Grid($grid, $rows) {
  $grid.DataSource = $null
  $table = New-Object System.Data.DataTable
  if (@($rows).Count -gt 0) {
    foreach ($property in $rows[0].PSObject.Properties) { [void]$table.Columns.Add($property.Name) }
    foreach ($row in $rows) {
      $entry = $table.NewRow()
      foreach ($property in $row.PSObject.Properties) { $entry[$property.Name] = [string]$property.Value }
      [void]$table.Rows.Add($entry)
    }
  }
  $grid.DataSource = $table
}
function Start-Operation($kind) {
  if ($script:job) { return }
  $mode = if ($target.SelectedIndex -eq 1) { 'r2' } else { 'local' }
  $script:jobKind = $kind
  $script:outFile = [System.IO.Path]::GetTempFileName()
  $script:errFile = [System.IO.Path]::GetTempFileName()
  try {
    $script:job = Start-Process -FilePath $node -ArgumentList @('node_modules/tsx/dist/cli.mjs','scripts/admin.ts',$kind,$mode,[string]$days.Value) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $script:outFile -RedirectStandardError $script:errFile -PassThru
    # Retain the native process handle before it exits. Windows PowerShell can
    # otherwise lose ExitCode for asynchronously started redirected processes.
    $null = $script:job.Handle
    $refresh.Enabled = $false
    $prepare.Enabled = $false
    $target.Enabled = $false
    $days.Enabled = $false
    $status.Text = "Running $kind for $mode. Preparation can take several minutes."
    if ($kind -eq 'prepare') { $tabs.SelectedTab = $logPage; $log.Text = '' }
  } catch { $status.Text = 'Could not start Node. Check installation and dependencies.'; $script:job = $null }
}
$target.Add_SelectedIndexChanged({
  $prepare.Text = if ($target.SelectedIndex -eq 1) { 'Prepare & publish to live R2' } else { 'Prepare local songs' }
  $healthGrid.DataSource = $null
  $status.Text = 'Target changed. Refresh dashboard to load this catalog.'
})
$refresh.Add_Click({ Start-Operation 'snapshot' })
$prepare.Add_Click({ Start-Operation 'prepare' })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 750
$timer.Add_Tick({
  if (!$script:job) { return }
  try {
    if ($script:jobKind -eq 'prepare') {
      $log.Text = [System.IO.File]::ReadAllText($script:outFile) + [System.IO.File]::ReadAllText($script:errFile)
      $log.SelectionStart = $log.TextLength
      $log.ScrollToCaret()
    }
    if (!$script:job.HasExited) { return }
    $script:job.WaitForExit()
    if ($script:jobKind -eq 'snapshot' -and $script:job.ExitCode -eq 0) {
      $snapshot = [System.IO.File]::ReadAllText($script:outFile) | ConvertFrom-Json
      Set-Grid $healthGrid @($snapshot.catalog.rows)
      Set-Grid $communityGrid @($snapshot.community.rows)
      Set-Grid $toolsGrid @($snapshot.tools)
      $status.Text = "$($snapshot.catalog.status). $($snapshot.community.status) Checked $($snapshot.checkedAt)"
      if ($snapshot.locked) { $status.Text += ' Worker lock present: preparation may already be running.' }
      $script:refreshValidated = $true
    } elseif ($script:jobKind -eq 'snapshot') {
      $status.Text = "Dashboard refresh failed (exit code $($script:job.ExitCode)). Check configuration and installed dependencies."
    } else {
      $status.Text = "Preparation exited with code $($script:job.ExitCode). Refresh dashboard to verify coverage."
    }
  } catch { $status.Text = 'Could not read operation output. Check configuration and retry.' }
  finally {
    if ($script:job -and $script:job.HasExited) {
      $script:job.Dispose(); $script:job = $null
      Remove-Item -LiteralPath $script:outFile,$script:errFile -ErrorAction SilentlyContinue
      $refresh.Enabled = $true; $prepare.Enabled = $true; $target.Enabled = $true; $days.Enabled = $true
      if ($ValidateRefresh) {
        Write-Output $status.Text
        Write-Output "Health rows: $($healthGrid.DataSource.Rows.Count); community rows: $($communityGrid.DataSource.Rows.Count)"
        $form.Close()
      }
    }
  }
})
$form.Add_FormClosing({
  if ($script:job) { $_.Cancel = $true; $status.Text = 'Wait for the current operation to finish before closing.' }
})
$form.Add_Shown({ Start-Operation 'snapshot' })
if ($ValidateOnly) {
  Set-Grid $healthGrid @([pscustomobject]@{ Date = '2026-09-10'; Category = 'EXYU'; Status = 'Missing assignment' })
  if ($healthGrid.DataSource.Rows.Count -ne 1) { throw 'Health grid binding failed' }
  Set-Grid $communityGrid @()
  if ($communityGrid.DataSource.Rows.Count -ne 0) { throw 'Empty community grid binding failed' }
  $form.Dispose()
  Write-Output 'Admin UI construction and data binding passed'
  exit 0
}
$timer.Start()
if ($ValidateRefresh) { $form.Opacity = 0; $form.ShowInTaskbar = $false }
[void]$form.ShowDialog()
$timer.Stop()
$form.Dispose()
if ($ValidateRefresh) {
  Write-Output $status.Text
  if (!$script:refreshValidated) { throw 'Desktop dashboard refresh failed' }
}
