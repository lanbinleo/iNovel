package main

import (
	"embed"

	"github.com/energye/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

//go:embed build/windows/icon.ico
var trayIcon []byte

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Setup systray with external loop (for Wails integration)
	systray.RunWithExternalLoop(func() {
		// onReady - setup tray icon and menu
		systray.SetIcon(trayIcon)
		systray.SetTitle("小说写作器")
		systray.SetTooltip("小说写作器 - 专注写作")

		// Click to show window
		systray.SetOnClick(func(menu systray.IMenu) {
			if app.ctx != nil {
				runtime.WindowShow(app.ctx)
			}
		})

		// Double click to show window
		systray.SetOnDClick(func(menu systray.IMenu) {
			if app.ctx != nil {
				runtime.WindowShow(app.ctx)
			}
		})

		// Right click to show menu
		systray.SetOnRClick(func(menu systray.IMenu) {
			menu.ShowMenu()
		})

		// Menu items
		mShow := systray.AddMenuItem("显示窗口", "显示主窗口")
		mShow.Click(func() {
			if app.ctx != nil {
				runtime.WindowShow(app.ctx)
			}
		})

		systray.AddSeparator()

		mQuit := systray.AddMenuItem("退出", "完全退出应用")
		mQuit.Click(func() {
			systray.Quit()
			if app.ctx != nil {
				runtime.Quit(app.ctx)
			}
		})
	}, func() {
		// onExit - cleanup
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "小说写作器",
		Width:     1400,
		Height:    900,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour:  &options.RGBA{R: 250, G: 248, B: 245, A: 1}, // 浅色主题背景
		Frameless:         true,                                        // 无边框窗口
		StartHidden:       false,
		HideWindowOnClose: true, // 关闭时隐藏而不是退出
		OnStartup:         app.startup,
		OnBeforeClose:     app.beforeClose,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		// 单实例锁定 - 再次启动时显示已有窗口
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "novel-writer-app-unique-id",
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				runtime.WindowShow(app.ctx)
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
