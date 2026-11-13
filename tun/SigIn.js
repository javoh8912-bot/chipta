const signupLink = document.querySelector('.auth-tabs a[href="sigUP.html"]')
const returnPath = new URLSearchParams(window.location.search).get("next")
if (signupLink && returnPath) signupLink.href = `sigUP.html?next=${encodeURIComponent(returnPath)}`
const themeLink = document.querySelector(".theme-toggle")
if (themeLink && returnPath) themeLink.href += `?next=${encodeURIComponent(returnPath)}`

document.querySelector("#signInForm").addEventListener("submit", event => {
  event.preventDefault()
  const username = document.querySelector("#username").value.trim()
  const password = document.querySelector("#password").value
  const registeredUsers = JSON.parse(localStorage.getItem("RegisteredUsers") || "[]")
  const user = [...Users, ...registeredUsers].find(item => item.username === username && item.password === password)

  if (!user) {
    document.querySelector("#authError").classList.remove("hidden")
    return
  }

  localStorage.setItem("username", user.username)
  localStorage.setItem("role", user.role)
  localStorage.setItem("gender", user.gender || "erkak")
  const next = new URLSearchParams(window.location.search).get("next")
  const safeNext = next && !next.startsWith("/") && !next.includes("://") ? next : null
  window.location.href = safeNext || (user.role === "admin" ? "adminPanel.html" : "index.html")
})
