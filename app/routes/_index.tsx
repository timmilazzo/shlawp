import { appPath } from "@agent-native/core/client/api-path";
import { redirect } from "react-router";

/**
 * The public root goes straight to Shlawp. The stock template marketing page
 * lived here; for a share-link demo the product is the landing page.
 */
export function loader() {
  return redirect(appPath("/home"));
}

export default function IndexRoute() {
  return null;
}
