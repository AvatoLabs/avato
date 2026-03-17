# Avato Android 签名工作流

这套工作流的目标只有一个：让 **开发调试** 和 **正式 release** 尽量复用同一套 keystore，避免飞书移动登录因为 `MD5` 在 debug / release 之间来回变化。

## 结论

- 只跑 `expo start` 不涉及重新签名。
- 但你要在手机上测试 **LarkSSO / 飞书原生登录**，就不能用 Expo Go。
- 原因是 Expo Go 不包含自定义原生模块，也不包含项目里的 `larksso-3.0.10.aar`。
- 所以必须使用：
  - `expo run:android` 安装到手机的 dev build
  - 或正式 `release APK`

这时 **安装到手机上的 Android 包签名** 就会参与飞书移动登录校验。

## 当前工程支持

当前工程已经支持：

- `release` 构建使用 `AVATO_RELEASE_*` 环境变量签名
- `debug` 构建可选复用 release keystore

也就是说，现在可以做到：

1. 本地开发调试安装到真机时，用 release keystore 签名
2. 正式产出 APK 时，也用同一个 release keystore 签名

这样飞书后台只需要登记一套 `Android 包名 + MD5`

## 需要的环境变量

```bash
export AVATO_RELEASE_STORE_FILE="/Users/arthur/RustroverProjects/lobehub/apps/mobile/android/avato-release.jks"
export AVATO_RELEASE_KEY_ALIAS="avato-release"
export AVATO_RELEASE_STORE_PASSWORD="your-password"
export AVATO_RELEASE_KEY_PASSWORD="your-password"
```

如果 `key password` 与 `store password` 相同，就直接设成一样的值。

## 工作流 A：真机开发调试，但保持正式签名

适用场景：

- 需要连 Metro 热更新
- 需要在手机上测试飞书原生登录
- 不希望 debug keystore 导致飞书 MD5 改变

执行：

```bash
/Users/arthur/RustroverProjects/lobehub/scripts/mobile/runSignedDevAndroid.sh
```

这条脚本会：

- 自动把 `debug` 构建改成复用 release keystore
- 执行 `bun run android`
- 安装到手机 / 模拟器

注意：

- 这是 **dev build**
- 仍然可以连 Metro
- 只是签名不再使用默认 debug keystore

## 工作流 B：生成正式 release APK

适用场景：

- 发安装包
- 提交给测试
- 需要拿稳定的飞书 MD5

执行：

```bash
/Users/arthur/RustroverProjects/lobehub/scripts/mobile/buildSignedReleaseApk.sh
```

输出：

```bash
/Users/arthur/RustroverProjects/lobehub/apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 飞书后台应该登记什么

飞书移动应用登录校验的是：

- Android 包名
- APK 实际签名证书的 `MD5`

不是文件本身的 `SHA-256`。

所以每次换 keystore 或换签名证书，都要重新计算并更新飞书后台。

## 推荐做法

- 开发调试与 release 统一使用同一个 release keystore
- 不再混用 debug keystore 测飞书原生登录
- 只有在完全不测飞书原生登录时，才使用默认 debug 签名

这样最省事，也最稳定。
