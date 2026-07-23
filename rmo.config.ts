import { Config } from "@remotion/cli/config";
import "dotenv/config";

// Chemin d'un Chrome/Chromium déjà installé (CHROME_EXECUTABLE_PATH dans .env).
// Absent ou égal à "false" -> Remotion télécharge et gère son propre Chromium.
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH;
if (chromeExecutablePath && chromeExecutablePath !== "false") {
  Config.setBrowserExecutable(chromeExecutablePath);
}
