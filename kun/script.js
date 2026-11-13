document.addEventListener("DOMContentLoaded", () => {
  const ticketsList = document.querySelector("#ticketsList")
  const searchForm = document.querySelector("#ticketSearch")
  const bookingSection = document.querySelector("#bookingSection")
  const account = document.querySelector("#account")
  const signedIn = Boolean(localStorage.getItem("username"))
  const params = new URLSearchParams(window.location.search)
  const pageBase = document.body.dataset.base || ""
  const pageFile = document.body.dataset.pageFile || "index.html"
  const mapScript = document.createElement("script")
  mapScript.src = `${pageBase}map.js`
  document.head.append(mapScript)
  let selectedTicket = null
  let selectedSeats = []
  let selectedCar = 1
  let activeMode = document.body.dataset.mode || "all"
  let searchCriteria = { from: "", to: "", date: "" }

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char])
  const formatPrice = value => `${Number(value).toLocaleString("uz-UZ")} so'm`
  const formatDate = value => String(value).split("-").reverse().join(".")

  function persistTickets() {
    localStorage.setItem("Tickets", JSON.stringify(Tickets))
  }

  function getMode(ticket) {
    return ticket.mode || "train"
  }

  function getVisibleTickets() {
    return Tickets.filter(ticket =>
      (activeMode === "all" || activeMode === "help" || getMode(ticket) === activeMode) &&
      (!searchCriteria.from || ticket.from.toLocaleLowerCase().includes(searchCriteria.from)) &&
      (!searchCriteria.to || ticket.to.toLocaleLowerCase().includes(searchCriteria.to)) &&
      (!searchCriteria.date || ticket.date === searchCriteria.date)
    )
  }

  function showAccount() {
    if (!account || !signedIn) return
    const username = escapeHtml(localStorage.getItem("username"))
    const adminLink = localStorage.getItem("role") === "admin" ? `<a class="button button-outline admin-nav-link" href="${pageBase}adminPanel.html" aria-label="Admin panel">Admin panel</a>` : ""
    account.innerHTML = `${adminLink}<span class="account-name">${username}</span><button class="button button-outline" id="signOut">Chiqish</button>`
    document.querySelector("#signOut").addEventListener("click", () => {
      ;["username", "role", "gender", "email", "number"].forEach(key => localStorage.removeItem(key))
      window.location.href = `${pageBase}index.html`
    })
  }

  function renderTickets(items = getVisibleTickets()) {
    if (!ticketsList) return
    ticketsList.replaceChildren()
    document.querySelector("#emptyTickets")?.classList.toggle("hidden", items.length > 0)
    items.forEach(ticket => {
      const card = document.createElement("article")
      card.className = "ticket-card"
      const mode = getMode(ticket)
      const capacity = mode === "train" ? 60 : 20
      const transportName = { train: "Poyezd", bus: "Avtobus", flight: "Samolyot" }[mode] || "Poyezd"
      const availableSeats = Math.max(0, capacity - (ticket.seats || []).length)
      card.innerHTML = `
        <div class="ticket-card-top"><span class="train-type">${transportName} · ${escapeHtml(ticket.type)}</span><span>${availableSeats} ta joy</span></div>
        <h3>${escapeHtml(ticket.train)}</h3>
        <div class="route-line"><div><strong>${escapeHtml(ticket.departure)}</strong><span>${escapeHtml(ticket.from)}</span></div><i aria-hidden="true"></i><div><strong>${escapeHtml(ticket.arrival)}</strong><span>${escapeHtml(ticket.to)}</span></div></div>
        <div class="ticket-card-bottom"><span>${escapeHtml(formatDate(ticket.date))}</span><strong>${formatPrice(ticket.price)}</strong></div>
        <button type="button" class="button button-primary buy-ticket" data-ticket-id="${escapeHtml(ticket.id)}">Bilet tanlash <span aria-hidden="true">→</span></button>`
      ticketsList.append(card)
    })
  }

  function requireSignIn(ticketId) {
    const next = `${pageFile}?ticket=${encodeURIComponent(ticketId)}#bookingSection`
    window.location.href = `${pageBase}sigIN.html?next=${encodeURIComponent(next)}`
  }

  function selectTicket(ticketId) {
    selectedTicket = Tickets.find(ticket => String(ticket.id) === String(ticketId))
    if (!selectedTicket) return
    selectedSeats = []
    selectedCar = 1
    bookingSection.classList.remove("hidden")
    document.querySelector("#bookingTitle").textContent = `${selectedTicket.from} — ${selectedTicket.to}`
    document.querySelector("#bookingTrain").textContent = `${selectedTicket.train} · ${selectedTicket.date} · ${selectedTicket.departure}`
    document.querySelector("#paymentPanel").classList.add("hidden")

    // Smooth 3D Model initialization and cinematic fly-in transition
    if (window.Vehicle3D) {
      window.Vehicle3D.show(selectedTicket, selectedSeats, on3DSeatSelect, on3DCarChange)
    }
    bookingSection.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function on3DSeatSelect(selection) {
    selectedCar = selection.car
    selectedSeats = selection.seats
    updateSelectionSummary()
  }

  function on3DCarChange(newCar) {
    selectedCar = newCar
    updateSelectionSummary()
  }

  function updateSelectionSummary() {
    const panel = document.querySelector("#paymentPanel")
    panel.classList.toggle("hidden", selectedSeats.length === 0)
    if (!selectedTicket || selectedSeats.length === 0) return
    const mode = getMode(selectedTicket)
    const seatNames = selectedSeats.map(seat => `${carLabel(mode, seat.car)}, ${seat.seat}-o'rindiq`).join("; ")
    const total = selectedTicket.price * selectedSeats.length
    document.querySelector("#selectedSeatLabel").textContent = `${selectedSeats.length} ta o'rindiq: ${seatNames}`
    document.querySelector("#paymentSummary").textContent = `${selectedTicket.train} · ${formatPrice(selectedTicket.price)} × ${selectedSeats.length} = ${formatPrice(total)}`
    document.querySelector(".pay-button").textContent = `To'lovni amalga oshirish · ${formatPrice(total)}`
  }

  function carLabel(mode, car) {
    if (mode === "bus") return "Avtobus"
    if (mode === "flight") return "Salon"
    return `${car}-vagon`
  }


  ticketsList?.addEventListener("click", event => {
    const button = event.target.closest("[data-ticket-id]")
    if (button) selectTicket(button.dataset.ticketId)
  })


  document.querySelector(".nav-links")?.addEventListener("click", event => {
    const link = event.target.closest("a")
    if (!link) return
    document.querySelectorAll(".nav-links a").forEach(item => item.classList.toggle("nav-current", item === link))
    if (link.dataset.mode) {
      activeMode = link.dataset.mode
      searchCriteria = { from: "", to: "", date: "" }
      searchForm?.reset()
      document.querySelector("#routesTitle").textContent = {
        all: "Barcha qatnovlar",
        train: "Poyezd chiptalari",
        bus: "Avtobus chiptalari",
        flight: "Aviachiptalar"
      }[activeMode]
      renderTickets()
    }
    document.querySelector(".ticket-nav")?.classList.remove("menu-open")
    document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false")
  })

  document.querySelector(".menu-toggle")?.addEventListener("click", event => {
    const button = event.currentTarget
    const isOpen = button.getAttribute("aria-expanded") === "true"
    button.setAttribute("aria-expanded", String(!isOpen))
    document.querySelector(".ticket-nav")?.classList.toggle("menu-open", !isOpen)
  })

  searchForm?.addEventListener("submit", event => {
    event.preventDefault()
    searchCriteria = {
      from: document.querySelector("#fromCity").value.trim().toLocaleLowerCase(),
      to: document.querySelector("#toCity").value.trim().toLocaleLowerCase(),
      date: document.querySelector("#travelDate").value
    }
    renderTickets()
  })

  document.querySelector("#paymentForm")?.addEventListener("submit", event => {
    event.preventDefault()
    if (!selectedTicket || selectedSeats.length === 0) return
    const currentTickets = JSON.parse(localStorage.getItem("Tickets") || "[]")
    const ticket = currentTickets.find(item => String(item.id) === String(selectedTicket.id))
    if (!ticket) {
      alert("Bu reys endi mavjud emas. Sahifani yangilang.")
      return
    }
    ticket.seats = ticket.seats || []
    const unavailableSeats = selectedSeats.filter(selected =>
      ticket.seats.some(seat => Number(seat.car) === selected.car && Number(seat.seat) === selected.seat)
    )
    if (unavailableSeats.length) {
      alert("Tanlangan o'rindiqlardan biri hozirgina band qilindi. O'rindiqlar ro'yxatini yangilab, qayta tanlang.")
      Tickets = currentTickets
      selectedTicket = ticket
      renderTickets()
      selectedSeats = selectedSeats.filter(selected =>
        !unavailableSeats.some(unavailable => unavailable.car === selected.car && unavailable.seat === selected.seat)
      )
      if (window.Vehicle3D) { window.Vehicle3D.show(selectedTicket, selectedSeats, on3DSeatSelect, on3DCarChange) }
      updateSelectionSummary()
      return
    }
    const cardNumber = document.querySelector("#cardNumber").value.replace(/\D/g, "")
    if (cardNumber.length !== 16) {
      alert("Karta raqamini 16 ta raqam bilan kiriting.")
      return
    }
    const cardholder = document.querySelector("#paymentForm input[autocomplete='cc-name']")?.value.trim()
    if (!localStorage.getItem("username") && cardholder) {
      localStorage.setItem("username", cardholder)
    }
    ticket.seats.push(...selectedSeats.map(seat => ({ ...seat, gender: localStorage.getItem("gender") || "erkak" })))
    localStorage.setItem("Tickets", JSON.stringify(currentTickets))
    alert(`${selectedSeats.length} ta o'rindiq uchun to'lov muvaffaqiyatli amalga oshdi.`)
    window.location.href = `${pageBase}${pageFile}#routes`
  })

  function configurePage() {
    const pageNames = {
      all: "Barcha qatnovlar",
      train: "Poyezd chiptalari",
      bus: "Avtobus chiptalari",
      flight: "Aviachiptalar",
      help: "Yordam"
    }
    const pageLinks = {
      all: `${pageBase}reyslar.html`,
      train: `${pageBase}poyezd.html`,
      bus: `${pageBase}avtobus.html`,
      flight: `${pageBase}aviachipta.html`,
      help: `${pageBase}yordam.html`
    }
    const transportLabels = {
      all: ["POYEZD · AVTOBUS · AVIACHIPTA", "Keyingi manzilingiz", "bir chipta narida.", "O'zingizga mos transportni tanlang, reyslarni solishtiring va safaringiz uchun chiptani qulay xarid qiling."],
      train: ["POYEZD SAFARLARI", "Poyezd chiptalarini", "qulay xarid qiling.", "Reyslarni solishtiring, 3D vagon ko'rinishida o'rindiq tanlang va safaringizni rejalashtiring."],
      bus: ["AVTOBUS SAFARLARI", "Avtobus chiptalarini", "oson tanlang.", "Yo'nalish va sanaga mos qatnov toping, 3D salon ichidan o'rindiq belgilang."],
      flight: ["AVIA SAFARLARI", "Samolyot chiptalarini", "tez toping.", "Qatnovlarni solishtiring, salon o'rindig'ini tanlang va safaringizni qulay rejalashtiring."],
      help: ["YORDAM VA MA'LUMOT", "Safaringizni", "ishonch bilan rejalang.", "Chipta tanlash, o'rindiq band qilish va demo to'lov bo'yicha ko'rsatmalar."]
    }
    const [eyebrow, title, emphasis, description] = transportLabels[activeMode] || transportLabels.all
    document.title = `Temiryo'l — ${pageNames[activeMode] || pageNames.all}`
    document.querySelector(".hero .eyebrow").textContent = eyebrow
    document.querySelector(".hero h1").innerHTML = `${title}<br><em>${emphasis}</em>`
    document.querySelector(".hero-copy p").textContent = description
    document.querySelector("#routesTitle").textContent = pageNames[activeMode] || pageNames.all
    document.querySelectorAll(".nav-links a").forEach(link => {
      const mode = link.dataset.mode || link.dataset.page
      link.href = pageLinks[mode]
      link.classList.toggle("nav-current", mode === activeMode)
    })
    document.querySelectorAll(".brand").forEach(link => {
      link.href = `${pageBase}index.html`
    })
    account?.querySelectorAll('a[href="sigIN.html"], a[href="sigUP.html"]').forEach(link => {
      link.href = `${pageBase}${link.getAttribute("href")}`
    })
    const themeLink = document.querySelector(".theme-toggle")
    if (themeLink) {
      const otherTheme = document.body.dataset.theme === "kun" ? "tun" : "kun"
      themeLink.href = `../${otherTheme}/${pageFile}`
    }
  }

  configurePage()
  showAccount()
  renderTickets()
  const requestedTicket = params.get("ticket")
  if (requestedTicket && signedIn) selectTicket(requestedTicket)
})
