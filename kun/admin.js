document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("role") !== "admin" || !localStorage.getItem("username")) {
    window.location.replace("sigIN.html")
    return
  }

  const form = document.querySelector("#ticketForm")
  const list = document.querySelector("#adminTicketList")
  const count = document.querySelector("#ticketCount")
  const modeSelect = document.querySelector("#mode")
  const typeSelect = document.querySelector("#type")
  const cancelEditButton = document.querySelector("#cancelEdit")
  let editingTicketId = null
  const serviceTypes = {
    train: ["Tezyurar", "Kechki", "Yo'lovchi"],
    bus: ["Komfort avtobus", "VIP avtobus"],
    flight: ["Uzbekistan Airways", "Silk Avia"]
  }
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char])

  function updateServiceTypes() {
    typeSelect.replaceChildren(...serviceTypes[modeSelect.value].map(type => new Option(type, type)))
  }

  function renderTickets() {
    const savedTickets = JSON.parse(localStorage.getItem("Tickets") || "[]")
    Tickets = savedTickets
    count.textContent = `(${Tickets.length})`
    list.replaceChildren()
    Tickets.forEach(ticket => {
      const row = document.createElement("article")
      row.className = "admin-ticket-row"
      const modeName = { train: "Poyezd", bus: "Avtobus", flight: "Samolyot" }[ticket.mode || "train"] || "Poyezd"
      row.innerHTML = `<div><strong>${escapeHtml(ticket.train)}</strong><span>${modeName} · ${escapeHtml(ticket.from)} → ${escapeHtml(ticket.to)} · ${escapeHtml(ticket.date)} · ${escapeHtml(ticket.departure)}</span></div><strong>${Number(ticket.price).toLocaleString("uz-UZ")} so'm</strong><button type="button" class="button button-outline edit-ticket" data-ticket-action="edit" data-ticket-id="${escapeHtml(ticket.id)}" aria-label="${escapeHtml(ticket.train)} reysini tahrirlash" title="Tahrirlash">✎</button><button type="button" class="button button-outline delete-ticket" data-ticket-action="delete" data-ticket-id="${escapeHtml(ticket.id)}">O'chirish</button>`
      list.append(row)
    })
  }

  function resetEditor() {
    editingTicketId = null
    form.reset()
    updateServiceTypes()
    document.querySelector("#ticketFormTitle").textContent = "Yangi chipta qo'shish"
    document.querySelector("#ticketSubmit").textContent = "Reysni saqlash"
    cancelEditButton.classList.add("hidden")
  }

  function startEditing(ticketId) {
    const ticket = Tickets.find(item => String(item.id) === ticketId)
    if (!ticket) return
    editingTicketId = ticketId
    modeSelect.value = ticket.mode || "train"
    updateServiceTypes()
    document.querySelector("#train").value = ticket.train
    typeSelect.value = ticket.type
    document.querySelector("#from").value = ticket.from
    document.querySelector("#to").value = ticket.to
    document.querySelector("#date").value = ticket.date
    document.querySelector("#departure").value = ticket.departure
    document.querySelector("#arrival").value = ticket.arrival
    document.querySelector("#price").value = ticket.price
    document.querySelector("#ticketFormTitle").textContent = "Reysni tahrirlash"
    document.querySelector("#ticketSubmit").textContent = "O'zgarishlarni saqlash"
    cancelEditButton.classList.remove("hidden")
    form.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  form.addEventListener("submit", event => {
    event.preventDefault()
    const tickets = JSON.parse(localStorage.getItem("Tickets") || "[]")
    const wasEditing = editingTicketId !== null
    const ticketData = {
      mode: modeSelect.value,
      train: document.querySelector("#train").value.trim(),
      type: document.querySelector("#type").value,
      from: document.querySelector("#from").value.trim(),
      to: document.querySelector("#to").value.trim(),
      date: document.querySelector("#date").value,
      departure: document.querySelector("#departure").value,
      arrival: document.querySelector("#arrival").value,
      price: Number(document.querySelector("#price").value)
    }
    if (editingTicketId !== null) {
      const ticket = tickets.find(item => String(item.id) === editingTicketId)
      if (!ticket) {
        alert("Tahrirlanayotgan reys topilmadi. Ro'yxat yangilandi.")
        resetEditor()
        renderTickets()
        return
      }
      Object.assign(ticket, ticketData)
    } else {
      tickets.push({
        ...ticketData,
        id: tickets.reduce((max, ticket) => Math.max(max, Number(ticket.id) || 0), 0) + 1,
        seats: []
      })
    }
    localStorage.setItem("Tickets", JSON.stringify(tickets))
    resetEditor()
    renderTickets()
    alert(wasEditing ? "Reys muvaffaqiyatli tahrirlandi." : "Reys muvaffaqiyatli saqlandi.")
  })

  modeSelect.addEventListener("change", updateServiceTypes)

  list.addEventListener("click", event => {
    const button = event.target.closest("[data-ticket-action][data-ticket-id]")
    if (!button) return
    if (button.dataset.ticketAction === "edit") {
      startEditing(button.dataset.ticketId)
      return
    }
    const tickets = JSON.parse(localStorage.getItem("Tickets") || "[]")
    const remaining = tickets.filter(ticket => String(ticket.id) !== button.dataset.ticketId)
    localStorage.setItem("Tickets", JSON.stringify(remaining))
    if (editingTicketId === button.dataset.ticketId) resetEditor()
    renderTickets()
  })

  cancelEditButton.addEventListener("click", resetEditor)
  renderTickets()
})
