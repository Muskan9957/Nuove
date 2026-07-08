// True only when running inside the Capacitor native app (Android / iOS).
// On the website window.Capacitor is undefined, so this returns false and the
// web app keeps its full Razorpay upgrade flow untouched.
//
// Used to hide in-app purchase / subscribe entry points in the store build:
// Apple and Google require digital subscriptions to go through their own
// billing, so the app launches free-first with no payment UI. (Web is unaffected.)
export const isNativeApp = () => {
  try {
    return !!(window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform())
  } catch {
    return false
  }
}
