const defaultTickets = [
  {
    id: 1,
    train: "Afrosiyob 762Ф",
    from: "Toshkent",
    to: "Samarqand",
    date: "2026-11-12",
    departure: "07:00",
    arrival: "09:15",
    mode: "train",
    type: "Tezyurar",
    price: 180000,
    seats: [
      { car: 1, seat: 3, gender: "erkak" },
      { car: 1, seat: 8, gender: "ayol" },
      { car: 2, seat: 5, gender: "erkak" }
    ]
  },
  {
    id: 2,
    train: "Sharq 010Ф",
    from: "Toshkent",
    to: "Buxoro",
    date: "2026-11-12",
    departure: "20:10",
    arrival: "06:30",
    mode: "train",
    type: "Kechki",
    price: 125000,
    seats: [{ car: 1, seat: 6, gender: "ayol" }]
  },
  {
    id: 3,
    train: "Nasaf 712Ф",
    from: "Samarqand",
    to: "Qarshi",
    date: "2026-11-13",
    departure: "10:20",
    arrival: "12:45",
    mode: "train",
    type: "Yo'lovchi",
    price: 85000,
    seats: []
  },
  {
    id: 4,
    train: "Toshkent — Samarqand Express",
    from: "Toshkent",
    to: "Samarqand",
    date: "2026-11-12",
    departure: "08:30",
    arrival: "12:00",
    mode: "bus",
    type: "Komfort avtobus",
    price: 75000,
    seats: [{ car: 1, seat: 4, gender: "erkak" }, { car: 1, seat: 11, gender: "ayol" }]
  },
  {
    id: 5,
    train: "Toshkent — Buxoro Express",
    from: "Toshkent",
    to: "Buxoro",
    date: "2026-11-13",
    departure: "07:15",
    arrival: "15:45",
    mode: "bus",
    type: "VIP avtobus",
    price: 110000,
    seats: []
  },
  {
    id: 6,
    train: "HY 271",
    from: "Toshkent",
    to: "Buxoro",
    date: "2026-11-12",
    departure: "09:20",
    arrival: "10:35",
    mode: "flight",
    type: "Uzbekistan Airways",
    price: 420000,
    seats: [{ car: 1, seat: 2, gender: "ayol" }, { car: 1, seat: 9, gender: "erkak" }]
  },
  {
    id: 7,
    train: "HY 045",
    from: "Toshkent",
    to: "Nukus",
    date: "2026-11-14",
    departure: "11:00",
    arrival: "12:40",
    mode: "flight",
    type: "Uzbekistan Airways",
    price: 510000,
    seats: []
  }
]

const storedTickets = JSON.parse(localStorage.getItem("Tickets") || "null")
const ticketSamplesAdded = localStorage.getItem("TicketTransportSamples")
let Tickets = Array.isArray(storedTickets) ? storedTickets : defaultTickets
Tickets.forEach(ticket => {
  if (!ticket.mode) ticket.mode = "train"
})
if (Array.isArray(storedTickets) && !ticketSamplesAdded) {
  const sampleIds = new Set(Tickets.map(ticket => Number(ticket.id)))
  Tickets.push(...defaultTickets.filter(ticket => ticket.mode !== "train" && !sampleIds.has(ticket.id)))
  localStorage.setItem("Tickets", JSON.stringify(Tickets))
  localStorage.setItem("TicketTransportSamples", "1")
}

const Users = [
  { id: 1, username: "admin", password: "admin123", role: "admin", gender: "erkak" },
  { id: 2, username: "user", password: "user123", role: "user", gender: "erkak" }
]

if (!Array.isArray(storedTickets)) {
  localStorage.setItem("Tickets", JSON.stringify(Tickets))
  localStorage.setItem("TicketTransportSamples", "1")
}
