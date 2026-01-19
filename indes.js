function openSection(id) {
  const sections = document.querySelectorAll(".content-section");
  sections.forEach((s) => s.classList.remove("active"));

  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((b) => b.classList.remove("active"));

  document.getElementById(id).classList.add("active");
  event.currentTarget.classList.add("active");
}
