/* Tela Contas: cadastro, edição, ativação e exclusão de contas. */
const AccountsScreen = {
	init() {
		document
			.getElementById("openAccountModal")
			?.addEventListener("click", () => this.openForm());
		document
			.querySelectorAll(".close-account-modal")
			.forEach((button) =>
				button.addEventListener("click", () =>
					FinanceCore.toggleModal("accountModal", false),
				),
			);
		document
			.getElementById("accountForm")
			?.addEventListener("submit", (event) => this.saveForm(event));
		document
			.getElementById("confirmDeleteAccountBtn")
			?.addEventListener("click", () => this.confirmDelete());
	},
	render() {
		const grid = document.getElementById("accountsGrid");
		if (!grid) return;
		const accounts = FinanceCore.accounts();
		grid.innerHTML = accounts.map((account) => this.card(account)).join("");
		document.getElementById("emptyAccountsState").style.display =
			accounts.length ? "none" : "flex";
		this.summary();
	},
	summary() {
		let active = 0,
			inactive = 0,
			count = 0;
		FinanceCore.accounts().forEach((account) => {
			const balance = this.balance(account);
			if (account.isActive) {
				active += balance;
				count++;
			} else inactive += balance;
		});
		FinanceCore.setText(
			"globalActiveBalance",
			FinanceCore.formatCurrency(active),
		);
		FinanceCore.setText(
			"globalInactiveBalance",
			FinanceCore.formatCurrency(inactive),
		);
		FinanceCore.setText(
			"totalActiveBalance",
			FinanceCore.formatCurrency(active),
		);
		FinanceCore.setText("activeAccountsCount", count);
		FinanceCore.setText(
			"totalAccountsCount",
			FinanceCore.accounts().length,
		);
	},
	balance(account) {
		return (
			FinanceCore.incomes(account).reduce((s, i) => s + i.value, 0) -
			FinanceCore.expenses(account).reduce((s, e) => s + e.value, 0) -
			FinanceCore.investments(account).reduce((s, i) => s + i.value, 0)
		);
	},
	card(account) {
		const active = account.isActive !== false;
		return `<div class="account-card glass${active ? "" : " account-inactive"}"><div class="account-accent accent-${account.color}"></div><div class="account-card-header"><div class="account-card-icon icon-${account.color}"><i class="ph ${account.icon}"></i></div><div class="account-card-name"><h3>${account.name}</h3><span class="account-badge ${active ? "badge-active" : "badge-inactive"}">${active ? "Ativa" : "Inativa"}</span></div></div><div class="account-card-balance"><span class="account-card-balance-label">Saldo atual</span><span class="account-card-balance-value">${FinanceCore.formatCurrency(this.balance(account))}</span></div><div class="account-card-actions"><button class="account-action-btn" onclick="App.toggleAccountActive('${account.id}')">${active ? "Desativar" : "Ativar"}</button><button class="account-action-btn btn-edit" onclick="App.openEditAccountModal('${account.id}')">Editar</button><button class="account-action-btn btn-delete" onclick="App.promptDeleteAccount('${account.id}')"><i class="ph ph-trash"></i></button></div></div>`;
	},
	openForm(account) {
		const form = document.getElementById("accountForm");
		form.reset();
		form.dataset.editId = account?.id || "";
		document.getElementById("accountModalTitle").textContent = account
			? `Editar: ${account.name}`
			: "Nova Conta Bancária";
		document.getElementById("accountInitialBalance").disabled =
			Boolean(account);
		if (account) {
			document.getElementById("accountName").value = account.name;
			document.getElementById("accountIcon").value = account.icon;
			document.getElementById("accountColor").value = account.color;
		}
		FinanceCore.toggleModal("accountModal", true);
	},
	async saveForm(event) {
		event.preventDefault();
		const form = event.target,
			editId = form.dataset.editId,
			name = document.getElementById("accountName").value.trim();
		if (!name) return;
		if (editId) {
			const account = FinanceCore.data.accounts[editId];
			account.name = name;
			account.icon = document.getElementById("accountIcon").value;
			account.color = document.getElementById("accountColor").value;
		} else {
			const id = `account_${Date.now()}`;
			const account = {
				id,
				name,
				icon: document.getElementById("accountIcon").value,
				color: document.getElementById("accountColor").value,
				isActive: true,
				entries: [],
				investments: [],
			};
			const initial =
				Number(
					document.getElementById("accountInitialBalance").value,
				) || 0;
			if (initial > 0)
				account.entries.push({
					id: Date.now() + 1,
					type: "income",
					value: initial,
					description: "Saldo Inicial",
					category: "other",
					notes: "Saldo inicial da conta",
					periodId: FinanceCore.data.currentPeriod,
					date: FinanceCore.today(),
					createdAt: new Date().toISOString(),
				});
			FinanceCore.data.accounts[id] = account;
		}
		await FinanceCore.save();
		FinanceCore.toggleModal("accountModal", false);
		App.refresh();
	},
	openEdit(id) {
		this.openForm(FinanceCore.data.accounts[id]);
	},
	async toggleActive(id) {
		if (id === "default") return;
		FinanceCore.data.accounts[id].isActive =
			!FinanceCore.data.accounts[id].isActive;
		await FinanceCore.save();
		App.refresh();
	},
	promptDelete(id) {
		this.pendingDelete = id;
		const account = FinanceCore.data.accounts[id];
		document.getElementById("deleteAccountMessage").textContent =
			`Deseja deletar a conta "${account.name}"?`;
		FinanceCore.toggleModal("deleteAccountModal", true);
	},
	async confirmDelete() {
		if (this.pendingDelete && this.pendingDelete !== "default")
			delete FinanceCore.data.accounts[this.pendingDelete];
		this.pendingDelete = null;
		await FinanceCore.save();
		FinanceCore.toggleModal("deleteAccountModal", false);
		App.refresh();
	},
};
