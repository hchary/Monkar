export function checkForUpdate() {
  if (!import.meta.env.PROD) return

  fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || data.buildId === __BUILD_ID__) return

      const flagKey = `reloaded-for-build:${data.buildId}`
      if (sessionStorage.getItem(flagKey)) return

      sessionStorage.setItem(flagKey, "1")
      window.location.reload()
    })
    .catch(() => {})
}
