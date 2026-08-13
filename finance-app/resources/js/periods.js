/* Tela Períodos: abertura, ativação, encerramento e remoção. */
const PeriodsScreen = {
	init() {
		document
			.getElementById("openPeriodModal")
			?.addEventListener("click", () => this.openForm());
		document
			.querySelectorAll(".close-period-modal")
			.forEach((button) =>
				button.addEventListener("click", () =>
					FinanceCore.toggleModal("periodModal", false),
				),
			);
		document
			.getElementById("periodForm")
			?.addEventListener("submit", (event) => this.saveForm(event));
		document
			.getElementById("closePeriodBtn")
			?.addEventListener("click", () => this.openCloseForm());
		document
			.getElementById("closePeriodForm")
			?.addEventListener("submit", (event) => this.closeCurrent(event));
		document
			.getElementById("confirmDeletePeriodBtn")
			?.addEventListener("click", () => this.confirmDelete());
	},
	render() {
		const grid = document.getElementById("periodsGrid");
		if (!grid) return;
		const current = FinanceCore.getCurrentPeriod();
		FinanceCore.setText("currentPeriodName", current?.name || "-");
		document.getElementById("currentPeriodAlert").style.display =
			current?.isOpen ? "flex" : "none";
		grid.innerHTML = FinanceCore.data.periods
			.map((period) => this.card(period))
			.join("");
		document.getElementById("emptyPeriodsState").style.display = FinanceCore
			.data.periods.length
			? "none"
			: "flex";
	},
	card(period) {
		const active = period.isOpen;
		return `<div class="period-card glass ${active ? "period-open" : "period-closed"}"><div class="period-card-header"><div class="period-card-title"><h3>${period.name}</h3><span class="period-badge">${active ? "Ativo" : "Inativo"}</span></div></div><div class="period-card-dates">${new Date(period.startDate).toLocaleDateString("pt-BR")} - ${period.endDate ? new Date(period.endDate).toLocaleDateString("pt-BR") : "Em aberto"}</div><div class="period-card-description">${period.description || "Sem descrição"}</div><div class="period-card-actions">${active ? "Período Ativo" : `<button class="btn-primary btn-sm" onclick="App.activatePeriod('${period.id}')">Ativar</button><button class="btn-secondary btn-sm" onclick="App.promptDeletePeriod('${period.id}')">Deletar</button>`}</div></div>`;
	},
	openForm() {
		document.getElementById("periodForm").reset();
		document.getElementById("periodStartDate").value = FinanceCore.today();
		FinanceCore.toggleModal("periodModal", true);
	},
	async saveForm(event) {
		event.preventDefault();
		const period = {
			id: `period_${Date.now()}`,
			name: document.getElementById("periodName").value.trim(),
			description: document
				.getElementById("periodDescription")
				.value.trim(),
			startDate: document.getElementById("periodStartDate").value,
			endDate: null,
			isOpen: FinanceCore.data.periods.length === 0,
			closeDescription: "",
			createdAt: new Date().toISOString(),
		};
		if (!period.name || !period.startDate) return;
		FinanceCore.data.periods.push(period);
		if (period.isOpen) FinanceCore.data.currentPeriod = period.id;
		await FinanceCore.save();
		FinanceCore.toggleModal("periodModal", false);
		App.refresh();
	},
	async activate(id) {
		FinanceCore.data.periods.forEach((period) => {
			period.isOpen = period.id === id;
			if (period.id === id) period.endDate = null;
		});
		FinanceCore.data.currentPeriod = id;
		await FinanceCore.save();
		App.refresh();
	},
	openCloseForm() {
		if (!FinanceCore.getCurrentPeriod()?.isOpen) return;
		document.getElementById("closePeriodDate").value = FinanceCore.today();
		FinanceCore.toggleModal("closePeriodModal", true);
	},
	async closeCurrent(event) {
		event.preventDefault();
		const period = FinanceCore.getCurrentPeriod();
		if (!period) return;
		period.isOpen = false;
		period.endDate = document.getElementById("closePeriodDate").value;
		period.closeDescription = document
			.getElementById("closePeriodDescription")
			.value.trim();
		await FinanceCore.save();
		FinanceCore.toggleModal("closePeriodModal", false);
		App.refresh();
	},
	promptDelete(id) {
		this.pendingDelete = id;
		FinanceCore.toggleModal("deletePeriodModal", true);
	},
	async confirmDelete() {
		const id = this.pendingDelete;
		FinanceCore.data.periods = FinanceCore.data.periods.filter(
			(period) => period.id !== id,
		);
		FinanceCore.accounts().forEach((account) => {
			account.entries = account.entries.filter(
				(entry) => entry.periodId !== id,
			);
		});
		if (FinanceCore.data.currentPeriod === id)
			FinanceCore.data.currentPeriod =
				FinanceCore.data.periods.find((period) => period.isOpen)?.id ||
				null;
		await FinanceCore.save();
		FinanceCore.toggleModal("deletePeriodModal", false);
		App.refresh();
	},
};
