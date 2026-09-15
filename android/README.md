# 大工宣讲日历 Android

联网版安卓应用，显示已发布的日历网站。支持 Android 8.0 及以上，建议更新 Android System WebView。网页及数据更新无需重装 APK。

## 使用

- 手机下载 APK，打开并按系统提示允许此次安装。
- 收藏保存在应用内，与系统浏览器的收藏分别保存；卸载应用会清除收藏。
- 导出日历会打开系统文件保存窗口。保存 ICS 后，可用支持 ICS 的日历应用导入；导入后不自动同步。
- 学校原文在外部浏览器打开。网络不可用时提供重试入口。
- 本应用只申请联网权限，不需要通讯录、位置或全部文件访问权限。

## 构建和签名

环境：JDK 17、Gradle 8.13、Android SDK 36。项目使用 AGP 8.13.0。

```sh
gradle -p android assembleDebug lintRelease
gradle -p android connectedDebugAndroidTest
```

正式版本通过仓库 `Build Android APK` 工作流手动构建。它编译、运行 lint、在 Android 15 模拟器测试浏览/收藏/ICS 文件保存，再用固定发布密钥签名并输出 APK 与 SHA256。

仓库密钥：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`。发布时从环境读取 `ANDROID_KEYSTORE_PATH` 与 `ANDROID_KEYSTORE_PASSWORD`，别名 `dlut-calendar`。私钥不在源码仓库内；请保留私钥备份，以便将来生成可以覆盖安装的新版。

原生消息接口只向本站 HTTPS 来源开放，并检查顶层页面与日历路径。导出内容必须是有长度限制的 VCALENDAR，文件位置由用户通过系统保存窗口选择。
