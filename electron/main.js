const fs = require('fs')
const os = require('os')
const BOOT_LOG = require('path').join(os.tmpdir(), 'gabia-birthday-boot.log')
function bootLog(msg) {
  try { fs.appendFileSync(BOOT_LOG, `[${new Date().toISOString()}] ${msg}\n`) } catch(e) {}
}
try { fs.writeFileSync(BOOT_LOG, '') } catch(e) {}
bootLog('=== 앱 시작 ===')

const { app, BrowserWindow, shell, dialog } = require('electron')
bootLog('electron require 성공')
const path = require('path')
const net = require('net')
const { execSync } = require('child_process')

const PORT = 3001
const USER_DATA = app.getPath('userData')
const DATA_DIR = path.join(USER_DATA, 'data')
const ENV_PATH = path.join(USER_DATA, '.env')
const LOG_PATH = path.join(USER_DATA, 'debug.log')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(LOG_PATH, line)
}

function killPortAndRetry() {
  try {
    log(`포트 ${PORT} 점유 프로세스 종료 시도`)
    bootLog(`포트 ${PORT} 점유 프로세스 종료 시도`)

    if (process.platform === 'win32') {
      // 윈도우: netstat으로 PID 찾아서 taskkill
      const result = execSync(`netstat -ano | findstr :${PORT}`).toString().trim()
      const pids = new Set()
      result.split('\n').forEach((line) => {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
      })
      pids.forEach((pid) => {
        try {
          execSync(`taskkill /PID ${pid} /F`)
          log(`PID ${pid} taskkill 완료`)
        } catch (e) {
          log(`PID ${pid} taskkill 실패: ${e}`)
        }
      })
    } else {
      // macOS/Linux: lsof
      const result = execSync(`lsof -ti :${PORT}`).toString().trim()
      if (result) {
        result.split('\n').forEach((pid) => {
          try {
            process.kill(parseInt(pid, 10), 'SIGKILL')
            log(`PID ${pid} kill 완료`)
          } catch (e) {
            log(`PID ${pid} kill 실패: ${e}`)
          }
        })
      }
    }

    setTimeout(() => {
      log('포트 해제 후 서버 재시작')
      startServer()
    }, 1000)
  } catch (e) {
    log(`killPortAndRetry 실패: ${e}`)
    app.quit()
  }
}

function ensureDirectories() {
  [DATA_DIR, path.join(DATA_DIR, 'backups')].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })
}

function ensureEnvFile() {
  const bundledEnvPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server/.env')
    : path.join(__dirname, '../server/.env')
  const examplePath = app.isPackaged
    ? path.join(process.resourcesPath, 'server/.env.example')
    : path.join(__dirname, '../server/.env.example')
  const sourcePath = fs.existsSync(bundledEnvPath) ? bundledEnvPath : examplePath
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, ENV_PATH)
  }
}

function loadEnvVars() {
  const bundledEnvPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server/.env')
    : path.join(__dirname, '../server/.env')
  const envPath = fs.existsSync(bundledEnvPath) ? bundledEnvPath : null
  if (!envPath) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

function startServer() {
  log('=== startServer 시작 ===')
  log(`isPackaged: ${app.isPackaged}`)
  log(`resourcesPath: ${process.resourcesPath}`)
  log(`USER_DATA: ${USER_DATA}`)
  log(`ENV_PATH: ${ENV_PATH}`)

  ensureDirectories()
  ensureEnvFile()
  log(`ENV_PATH 존재: ${fs.existsSync(ENV_PATH)}`)
  if (fs.existsSync(ENV_PATH)) {
    log(`ENV 내용:\n${fs.readFileSync(ENV_PATH, 'utf-8')}`)
  }

  loadEnvVars()
  log(`HIWORKS_CLIENT_ID: ${process.env.HIWORKS_CLIENT_ID ? '설정됨' : '없음'}`)
  log(`HIWORKS_AUTH_URL: ${process.env.HIWORKS_AUTH_URL ? '설정됨' : '없음'}`)

  process.env.DATA_DIR = DATA_DIR
  process.env.ENV_PATH = ENV_PATH
  process.env.NODE_ENV = 'production'

  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server/dist/bundle.js')
    : path.join(__dirname, '../server/dist/bundle.js')

  log(`serverPath: ${serverPath}`)
  log(`serverPath 존재: ${fs.existsSync(serverPath)}`)

  const originalExit = process.exit.bind(process)
  process.exit = (code) => {
    log(`process.exit(${code}) 호출됨`)
    log(`stack: ${new Error().stack}`)
    originalExit(code)
  }

  try {
    require(serverPath)
    log('서버 require 성공')
  } catch (err) {
    log(`서버 require 실패: ${err.stack || err}`)
    app.quit()
  }
}

function waitForServer(callback) {
  const tryConnect = () => {
    const client = net.connect(PORT, '127.0.0.1', () => {
      client.destroy()
      callback()
    })
    client.on('error', () => setTimeout(tryConnect, 300))
  }
  tryConnect()
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: '가비아 생일 관리',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(`http://localhost:${PORT}`)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

process.on('exit', (code) => {
  bootLog(`process exit with code: ${code}`)
  bootLog(`stack: ${new Error().stack}`)
})

app.on('will-quit', (e) => {
  bootLog('will-quit 이벤트')
})

app.on('quit', (e, exitCode) => {
  bootLog(`quit 이벤트, exitCode: ${exitCode}`)
})

process.on('uncaughtException', (err) => {
  bootLog(`uncaughtException: ${err.message}`)
  try { log(`uncaughtException: ${err.stack || err}`) } catch(e) {}
  if (err.code === 'EADDRINUSE') {
    bootLog('EADDRINUSE → killPortAndRetry 호출')
    killPortAndRetry()
  } else {
    app.quit()
  }
})

bootLog(`userData: ${USER_DATA}`)
bootLog(`app.isPackaged: ${app.isPackaged}`)
bootLog('app.whenReady 등록')
app.whenReady().then(() => {
  bootLog('app.whenReady 진입')
  startServer()
  bootLog('startServer 완료, waitForServer 시작')
  waitForServer(() => {
    bootLog('서버 연결 확인, createWindow 호출')
    createWindow()
    bootLog('createWindow 완료')
  })
})

app.on('window-all-closed', () => {
  bootLog('window-all-closed 이벤트')
  // macOS에서는 창을 모두 닫아도 앱(서버)을 유지 (Dock 클릭 시 재실행 가능)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  bootLog('activate 이벤트')
  if (BrowserWindow.getAllWindows().length === 0) {
    bootLog('activate: 창 없음 → createWindow 호출')
    createWindow()
  }
})
