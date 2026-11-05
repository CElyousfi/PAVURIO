/**
 * Android widgets: a tap opens the app at the right screen.
 *
 * expo-widgets turns a widget button press into a broadcast to the widget's provider. Pavurio's widgets
 * are one big button whose target is "open:<route>"; this plugin makes each generated provider open
 * pavurio://<route> for those targets (other targets keep the default handling).
 * It is listed before expo-widgets in app.json: dangerous mods run last-registered first, so this one
 * runs after expo-widgets has written the providers.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const PROVIDER = (pkg, name) => `package ${pkg}

import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

class ${name}Provider : ExpoWidgetsAppWidgetProvider(${JSON.stringify(name)}) {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "expo.modules.widgets.ACTION_WIDGET_INTERACTION") {
      val target = intent.getStringExtra("expo.modules.widgets.extra.TARGET")
      if (target != null && target.startsWith("open:")) {
        val route = target.removePrefix("open:").trimStart('/')
        val open = Intent(Intent.ACTION_VIEW, Uri.parse("pavurio://" + route)).apply {
          setPackage(context.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try {
          context.startActivity(open)
        } catch (e: Exception) {
          context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(it)
          }
        }
        return
      }
    }
    super.onReceive(context, intent)
  }
}
`;

module.exports = function withWidgetTapOpens(config, { widgets = [] } = {}) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) return cfg;
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      for (const name of widgets) {
        const file = path.join(dir, `${name}Provider.kt`);
        if (fs.existsSync(path.dirname(file))) fs.writeFileSync(file, PROVIDER(pkg, name));
      }
      return cfg;
    },
  ]);
};
