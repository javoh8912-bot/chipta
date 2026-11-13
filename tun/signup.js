const requestedNext = new URLSearchParams(window.location.search).get("next")
const themeLink = document.querySelector(".theme-toggle")
if (themeLink && requestedNext) themeLink.href += `?next=${encodeURIComponent(requestedNext)}`

document.querySelector("#signUpForm").addEventListener("submit", event => {
  event.preventDefault()
  const username = document.querySelector("#newUsername").value.trim()
  const email = document.querySelector("#newEmail").value.trim()
  const phone = document.querySelector("#newPhone").value.trim()
  const gender = document.querySelector("#newGender").value
  const password = document.querySelector("#newPassword").value
  const registeredUsers = JSON.parse(localStorage.getItem("RegisteredUsers") || "[]")
  const error = document.querySelector("#authError")

  if ([...Users, ...registeredUsers].some(user => user.username.toLowerCase() === username.toLowerCase())) {
    error.textContent = "Bu foydalanuvchi nomi band. Boshqasini tanlang."
    error.classList.remove("hidden")
    return
  }

  registeredUsers.push({ id: Date.now(), username, email, phone, gender, password, role: "user" })
  localStorage.setItem("RegisteredUsers", JSON.stringify(registeredUsers))
  localStorage.setItem("username", username)
  localStorage.setItem("role", "user")
  localStorage.setItem("gender", gender)
  const safeNext = requestedNext && !requestedNext.startsWith("/") && !requestedNext.includes("://") ? requestedNext : null
  window.location.href = safeNext || "index.html"
})
