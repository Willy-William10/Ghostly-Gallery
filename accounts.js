import { drawQrCode } from "./qr.js";
import { playUiSound } from "./sounds.js";

const STORAGE = {
  accounts: "ghostly.accounts.v1",
  localSession: "ghostly.session.local.v1",
  onboarding: "ghostly.onboarding.done.v1",
  theme: "ghostly.theme.v1"
};
const ID_PATTERN = /^[A-Z0-9]{20}$/;
const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_ -]{1,23}$/u;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export class AccountManager {
  constructor({ dialog, content, onChange, notify }) {
    this.dialog = dialog;
    this.content = content;
    this.onChange = onChange;
    this.notify = notify;
    this.user = null;
    this.favoriteIds = new Set();
    this.cameraStream = null;
    this.scanTimer = null;
    this.signupDraft = { username: "", id: "", qrReady: false };
    this.bindChrome();
  }

  initialize() {
    this.user = this.restoreSession();
    this.loadFavorites();
    this.refreshChrome();
    this.onChange?.(this.user, this.favoriteIds);
    let onboardingDone = false;
    try { onboardingDone = Boolean(localStorage.getItem(STORAGE.onboarding)); } catch { /* Continue without persistence if storage is blocked. */ }
    if (!this.user && !onboardingDone) this.showWelcome();
    else if (!this.user) this.setGuest(false);
  }

  getFavorites() { return new Set(this.favoriteIds); }
  isAuthenticated() { return this.user?.mode === "account"; }

  toggleFavorite(id) {
    if (this.favoriteIds.has(id)) this.favoriteIds.delete(id);
    else this.favoriteIds.add(id);
    this.saveFavorites();
    this.refreshChrome();
    this.onChange?.(this.user, this.favoriteIds);
    return this.favoriteIds.has(id);
  }

  openProfile() {
    if (this.isAuthenticated()) this.showAccountCenter();
    else this.showWelcome();
  }

  showWelcome() {
    this.stopCamera();
    this.content.replaceChildren();
    const view = el("section", "welcome-view");
    const art = el("div", "welcome-art");
    const mascot = el("img");
    mascot.src = "assets/brand/ghostly-transparent.png";
    mascot.alt = "";
    art.append(mascot);
    view.append(art);
    view.append(el("p", "eyebrow", "WELCOME TO THE HAUNT"));
    const title = el("h1");
    title.id = "auth-title";
    title.append(document.createTextNode("Your little corner of "));
    const accent = el("span", "", "weird.");
    title.append(accent);
    view.append(title);
    view.append(el("p", "", "Make a local profile to keep your favourites close, or wander in as a guest."));
    const actions = el("div", "auth-actions");
    const guestChoice = this.choice("guest", "Continue without an account", "Browse and save favourites locally", "");
    guestChoice.classList.add("guest-choice");
    actions.append(
      this.choice("signup", "Sign up", "Create a Ghostly profile on this browser", "✧"),
      this.choice("login", "Log in", "Return to a profile saved here", "↗"),
      guestChoice
    );
    view.append(actions, this.localNote());
    this.content.append(view);
    this.content.querySelector('[data-auth="signup"]').addEventListener("click", () => this.showSignup());
    this.content.querySelector('[data-auth="login"]').addEventListener("click", () => this.showLogin());
    this.content.querySelector('[data-auth="guest"]').addEventListener("click", () => this.setGuest(true));
    this.openDialog();
    this.dialog.dataset.requiredChoice = "true";
  }

  choice(action, title, description, glyph) {
    const button = el("button", "auth-choice");
    button.type = "button";
    button.dataset.auth = action;
    const icon = el("span", "choice-icon", glyph);
    const copy = el("span", "choice-label");
    copy.append(el("strong", "", title), el("small", "", description));
    button.append(icon, copy, el("span", "choice-arrow", "›"));
    return button;
  }

  localNote() {
    const note = el("p", "local-only-note");
    note.append(iconSvg("<path d=\"M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z\"/><path d=\"m9 12 2 2 4-4\"/>"));
    note.append(document.createTextNode("Profiles and favourites are stored only in this browser. There is no account server or cross-device sync."));
    return note;
  }

  showSignup() {
    this.stopCamera();
    this.signupDraft = { username: "", id: "", qrReady: false };
    this.content.replaceChildren();
    const view = el("section", "auth-view");
    const title = el("h1", "", "Create your profile"); title.id = "auth-title";
    view.append(this.backButton(() => this.showWelcome()), el("p", "eyebrow", "MAKE A LITTLE HOME"), title);
    view.append(el("p", "auth-intro", "Choose a name, generate your private 20-character key, then save the QR for quick sign-in on this browser."));
    const nameLabel = el("label", "field-label", "Username");
    const row = el("span", "input-row");
    const nameInput = el("input");
    nameInput.id = "signup-username";
    nameInput.type = "text";
    nameInput.name = "username";
    nameInput.autocomplete = "nickname";
    nameInput.maxLength = 24;
    nameInput.placeholder = "A name for your corner";
    nameInput.required = true;
    nameInput.setAttribute("aria-describedby", "signup-name-hint signup-error");
    const generate = el("button", "generate-button", "Generate ID");
    generate.type = "button";
    generate.hidden = true;
    generate.append(iconSvg("<path d=\"M20 7v5h-5M4 17v-5h5\"/><path d=\"M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3\"/>"));
    row.append(nameInput, generate);
    nameLabel.append(row);
    nameLabel.append(el("small", "field-hint", "2–24 letters, numbers, spaces, underscores, or hyphens."));
    nameLabel.querySelector("small").id = "signup-name-hint";
    const error = el("p", "auth-message");
    error.id = "signup-error";
    error.setAttribute("role", "status");
    const generated = el("div", "generated-panel");
    generated.hidden = true;
    const idDetails = el("div");
    idDetails.append(el("p", "generated-id-label", "Your 20-character account ID"));
    const idText = el("strong", "generated-id");
    const idActions = el("div", "id-actions");
    const copy = el("button", "small-action", "Copy ID");
    copy.type = "button";
    const downloadQr = el("button", "small-action", "Save QR");
    downloadQr.type = "button";
    idActions.append(copy, downloadQr);
    idDetails.append(idText, idActions);
    const qrColumn = el("div");
    const qrBox = el("div", "qr-box");
    const canvas = el("canvas");
    qrBox.append(canvas);
    qrColumn.append(qrBox, el("p", "qr-caption", "Your ID is encoded locally. Nothing is sent anywhere."));
    generated.append(idDetails, qrColumn);
    const confirmLabel = el("label", "confirm-check");
    const acknowledge = el("input");
    acknowledge.type = "checkbox";
    acknowledge.id = "signup-confirm-check";
    const confirmText = document.createTextNode("I’ve saved my ID or QR. It only works with the local profile saved in this browser.");
    confirmLabel.append(acknowledge, confirmText);
    confirmLabel.hidden = true;
    const remember = this.rememberControl("signup-remember");
    const submit = el("button", "auth-submit", "Create profile");
    submit.type = "button";
    submit.disabled = true;
    view.append(nameLabel, error, generated, confirmLabel, remember, submit);
    this.content.append(view);

    nameInput.addEventListener("input", () => {
      const normalized = nameInput.value.trim();
      const valid = USERNAME_PATTERN.test(normalized);
      generate.hidden = !valid;
      if (this.signupDraft.id) {
        this.signupDraft = { username: normalized, id: "", qrReady: false };
        generated.hidden = true;
        confirmLabel.hidden = true;
        acknowledge.checked = false;
        submit.disabled = true;
      } else this.signupDraft.username = normalized;
      error.textContent = normalized && !valid ? "Choose 2–24 letters or numbers, with spaces, underscores, or hyphens after the first character." : "";
    });
    generate.addEventListener("click", () => {
      if (!USERNAME_PATTERN.test(nameInput.value.trim())) return;
      try {
        const id = this.generateUniqueId();
        drawQrCode(canvas, id);
        playUiSound("sparkle");
        this.signupDraft = { username: nameInput.value.trim(), id, qrReady: true };
        idText.textContent = id;
        generated.hidden = false;
        confirmLabel.hidden = false;
        submit.disabled = !acknowledge.checked;
        error.textContent = "";
      } catch (cause) {
        this.signupDraft = { username: nameInput.value.trim(), id: "", qrReady: false };
        error.textContent = cause instanceof Error ? cause.message : "This browser could not create a secure ID and QR code.";
        generated.hidden = true;
        confirmLabel.hidden = true;
        submit.disabled = true;
      }
    });
    acknowledge.addEventListener("change", () => { submit.disabled = !(acknowledge.checked && this.signupDraft.qrReady); });
    copy.addEventListener("click", () => this.copyText(this.signupDraft.id));
    downloadQr.addEventListener("click", () => this.downloadQr(canvas, this.signupDraft.id));
    submit.addEventListener("click", () => this.finishSignup(remember.querySelector("input").checked, acknowledge.checked, error));
    this.openDialog();
    this.dialog.dataset.requiredChoice = "false";
    nameInput.focus();
  }

  finishSignup(remember, acknowledged, error) {
    const { username, id, qrReady } = this.signupDraft;
    if (!USERNAME_PATTERN.test(username) || !ID_PATTERN.test(id) || !qrReady || !acknowledged) return;
    const accounts = this.readAccounts();
    if (accounts.some((account) => account.id === id)) {
      error.textContent = "That ID already exists here. Generate a new one.";
      return;
    }
    const record = { id, username, createdAt: new Date().toISOString() };
    if (!this.writeAccounts([...accounts, record])) {
      error.textContent = "This browser could not save the profile. Check local storage settings and try again.";
      return;
    }
    this.completeLogin(record, remember);
    playUiSound("success");
    this.notify("Your Ghostly profile is ready on this browser.");
  }

  showLogin() {
    this.stopCamera();
    this.content.replaceChildren();
    const view = el("section", "auth-view");
    const title = el("h1", "", "Log in"); title.id = "auth-title";
    view.append(this.backButton(() => this.showWelcome()), el("p", "eyebrow", "COME BACK IN"), title);
    view.append(el("p", "auth-intro", "Use the account ID or QR you created in this browser. Profiles are stored locally and don’t sync to other devices."));
    const methods = el("div", "login-methods");
    const scan = methodButton("Scan QR code", "Allow camera when asked", "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><path d=\"M14 14h3v3h-3zm4 4h3v3h-3m0-7v1\"/>");
    const manual = methodButton("Enter ID manually", "20 uppercase letters or numbers", "<path d=\"M4 7h16M4 12h16M4 17h9\"/><path d=\"m17 16 2 2 3-4\"/>");
    methods.append(scan, manual);
    const camera = el("div", "camera-frame");
    camera.hidden = true;
    const cameraMessage = el("p", "", "Your camera will only be requested after you choose Scan QR code.");
    camera.append(cameraMessage);
    const manualForm = el("form", "manual-login");
    manualForm.hidden = true;
    manualForm.autocomplete = "off";
    const idLabel = el("label", "field-label", "Account ID");
    const idInput = el("input");
    idInput.id = "login-id";
    idInput.name = "account-id";
    idInput.type = "text";
    idInput.autocomplete = "off";
    idInput.spellcheck = false;
    idInput.maxLength = 20;
    idInput.placeholder = "20 characters";
    idInput.setAttribute("aria-describedby", "login-id-hint login-message");
    idLabel.append(idInput);
    idLabel.append(el("small", "field-hint", "Use uppercase A–Z and digits 0–9."));
    idLabel.querySelector("small").id = "login-id-hint";
    const remember = this.rememberControl("login-remember");
    const submit = el("button", "auth-submit", "Log in");
    submit.type = "submit";
    const message = el("p", "auth-message");
    message.id = "login-message";
    message.setAttribute("role", "status");
    manualForm.append(idLabel, remember, submit);
    const chooseHint = el("p", "auth-message");
    chooseHint.textContent = "Choose a sign-in method above.";
    view.append(methods, camera, manualForm, message, chooseHint, this.localNote());
    this.content.append(view);

    manual.addEventListener("click", () => {
      this.stopCamera();
      camera.hidden = true;
      manualForm.hidden = false;
      chooseHint.hidden = true;
      manual.classList.add("is-selected");
      scan.classList.remove("is-selected");
      idInput.focus();
    });
    scan.addEventListener("click", () => {
      manualForm.hidden = true;
      camera.hidden = false;
      chooseHint.hidden = true;
      scan.classList.add("is-selected");
      manual.classList.remove("is-selected");
      this.startCamera(camera, cameraMessage, (id) => {
        this.loginWithId(id, remember.querySelector("input").checked, message);
      });
    });
    idInput.addEventListener("input", () => {
      idInput.value = idInput.value.toUpperCase().slice(0, 20);
      message.textContent = "";
    });
    manualForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.loginWithId(idInput.value, remember.querySelector("input").checked, message);
    });
    this.openDialog();
    this.dialog.dataset.requiredChoice = "false";
  }

  startCamera(frame, message, onResult) {
    this.stopCamera();
    if (!("BarcodeDetector" in window)) {
      message.textContent = "QR scanning isn’t supported in this browser. Choose Enter ID manually instead.";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      message.textContent = "Camera access isn’t available here. Choose Enter ID manually instead.";
      return;
    }
    let detector;
    try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
    catch { message.textContent = "This browser can’t scan QR codes. Choose Enter ID manually instead."; return; }
    message.textContent = "Allow camera access, then hold your QR steady inside the frame.";
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (stream) => {
        if (!this.dialog.open) { stream.getTracks().forEach((track) => track.stop()); return; }
        this.cameraStream = stream;
        const video = el("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.srcObject = stream;
        frame.replaceChildren(video, el("span", "camera-corners"));
        try { await video.play(); }
        catch {
          this.stopCamera();
          message.textContent = "The camera is ready, but playback failed. Try entering your ID manually.";
          frame.replaceChildren(message);
          return;
        }
        const scanFrame = async () => {
          if (!this.cameraStream || !this.dialog.open) return;
          try {
            const codes = await detector.detect(video);
            const value = codes.find((code) => code.rawValue)?.rawValue;
            if (value) { this.stopCamera(); onResult(value); return; }
          } catch { /* A not-yet-ready camera frame can be skipped. */ }
          this.scanTimer = window.setTimeout(scanFrame, 260);
        };
        scanFrame();
      })
      .catch((error) => {
        message.textContent = error?.name === "NotAllowedError" ? "Camera access was declined. You can enter your ID manually." : "The camera couldn’t start. You can enter your ID manually.";
      });
  }

  loginWithId(value, remember, message) {
    const id = String(value || "").trim().toUpperCase();
    if (!ID_PATTERN.test(id)) {
      message.textContent = "Enter exactly 20 characters using A–Z and 0–9.";
      return;
    }
    const account = this.readAccounts().find((item) => item.id === id);
    if (!account) {
      message.textContent = "No matching profile is saved in this browser. Profiles don’t sync between devices.";
      return;
    }
    this.completeLogin(account, remember);
    playUiSound("success");
    this.notify(`Welcome back, ${account.username}.`);
  }

  completeLogin(account, remember) {
    this.stopCamera();
    this.user = { mode: "account", id: account.id, username: account.username };
    this.saveSession(this.user, remember);
    this.markOnboardingDone();
    this.loadFavorites();
    this.closeDialog();
    this.refreshChrome();
    this.onChange?.(this.user, this.favoriteIds);
  }

  setGuest(showMessage = true) {
    this.stopCamera();
    this.user = { mode: "guest", username: "Guest" };
    this.saveSession(this.user, true);
    this.markOnboardingDone();
    this.loadFavorites();
    this.closeDialog();
    this.refreshChrome();
    this.onChange?.(this.user, this.favoriteIds);
    if (showMessage) { playUiSound("success"); this.notify("You’re browsing as a guest. Favourites stay in this browser."); }
  }

  logout() {
    if (!this.isAuthenticated()) return;
    this.user = { mode: "guest", username: "Guest" };
    this.saveSession(this.user, true);
    this.loadFavorites();
    this.closeAccountCenter();
    this.refreshChrome();
    this.onChange?.(this.user, this.favoriteIds);
    this.notify("You’re now browsing as a guest.");
  }

  showAccountCenter() {
    if (!this.isAuthenticated()) return this.showWelcome();
    const dialog = document.querySelector("#account-dialog");
    const content = document.querySelector("#account-content");
    content.replaceChildren();
    const shell = el("section", "account-view");
    const close = closeButton(() => dialog.close());
    shell.append(close);
    const heading = el("div", "account-heading");
    const avatar = el("span", "account-avatar", this.initial(this.user.username));
    const title = el("div");
    const titleHeading = el("h1", "", this.user.username); titleHeading.id = "account-title";
    title.append(el("p", "eyebrow", "YOUR ACCOUNT CENTER"), titleHeading);
    heading.append(avatar, title);
    shell.append(heading);
    const card = el("div", "account-id-card");
    card.append(el("small", "", "Local account ID"), el("strong", "", this.user.id));
    const actions = el("div", "account-actions");
    const copy = el("button", "", "Copy ID");
    copy.type = "button";
    const showQr = el("button", "", "Show my QR");
    showQr.type = "button";
    const edit = el("button", "", "Edit username");
    edit.type = "button";
    const logout = el("button", "danger-action", "Log out");
    logout.type = "button";
    actions.append(copy, showQr, edit, logout);
    const info = el("div", "account-info");
    info.append(this.infoRow("Favourites", String(this.favoriteIds.size)), this.infoRow("Where it lives", "This browser only"));
    const note = el("p", "settings-note", "This static gallery has no account server. Your profile and favourites stay in this browser; they do not sync to other devices. Keep your ID private, and don’t use it as a password elsewhere.");
    shell.append(card, actions, info, note);
    content.append(shell);
    copy.addEventListener("click", () => this.copyText(this.user.id));
    showQr.addEventListener("click", () => this.showAccountQr(dialog, card));
    edit.addEventListener("click", () => this.editUsername(shell));
    logout.addEventListener("click", () => this.logout());
    if (!dialog.open) dialog.showModal();
  }

  showAccountQr(dialog, card) {
    if (card.nextElementSibling?.classList.contains("generated-panel")) return;
    const panel = el("div", "generated-panel");
    const details = el("div");
    details.append(el("p", "generated-id-label", "Your sign-in QR"), el("p", "field-hint", "Only use this QR in your browser. It contains your account ID."));
    const save = el("button", "small-action", "Save QR image");
    save.type = "button";
    details.append(save);
    const column = el("div");
    const box = el("div", "qr-box");
    const canvas = el("canvas");
    box.append(canvas);
    column.append(box);
    panel.append(details, column);
    card.after(panel);
    try { drawQrCode(canvas, this.user.id); }
    catch { save.disabled = true; panel.append(el("p", "field-error", "This browser could not draw the QR code.")); }
    save.addEventListener("click", () => this.downloadQr(canvas, this.user.id));
    dialog.dataset.qrShown = "true";
  }

  editUsername(shell) {
    if (shell.querySelector(".rename-form")) return;
    const form = el("form", "rename-form");
    const label = el("label", "field-label", "Profile name");
    const input = el("input");
    input.value = this.user.username;
    input.maxLength = 24;
    input.required = true;
    label.append(input);
    const save = el("button", "small-action", "Save name");
    save.type = "submit";
    const cancel = el("button", "small-action", "Cancel");
    cancel.type = "button";
    const error = el("p", "auth-message");
    form.append(label, error, save, cancel);
    shell.append(form);
    cancel.addEventListener("click", () => form.remove());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = input.value.trim();
      if (!USERNAME_PATTERN.test(username)) { error.textContent = "Choose a valid name with 2–24 characters."; return; }
      const accounts = this.readAccounts();
      const updated = accounts.map((account) => account.id === this.user.id ? { ...account, username } : account);
      if (!this.writeAccounts(updated)) { error.textContent = "This browser could not save the change."; return; }
      this.user = { ...this.user, username };
      this.saveSession(this.user, this.hasRememberedSession());
      this.refreshChrome();
      this.onChange?.(this.user, this.favoriteIds);
      this.notify("Profile name updated.");
      this.showAccountCenter();
    });
    input.focus();
  }

  infoRow(label, value) {
    const row = el("p");
    row.append(el("span", "", label), el("strong", "", value));
    return row;
  }

  rememberControl(id) {
    const label = el("label", "remember-row");
    const input = el("input");
    input.type = "checkbox";
    input.id = id;
    label.append(input, document.createTextNode("Remember me"), el("span", "", "Keep me signed in here"));
    return label;
  }

  backButton(action) {
    const button = el("button", "auth-back");
    button.type = "button";
    button.append(el("span", "", "←"), document.createTextNode("Back"));
    button.addEventListener("click", action);
    return button;
  }

  openDialog() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  closeDialog() {
    this.stopCamera();
    this.dialog.dataset.requiredChoice = "false";
    if (this.dialog.open) this.dialog.close();
  }

  closeAccountCenter() {
    const dialog = document.querySelector("#account-dialog");
    if (dialog.open) dialog.close();
  }

  bindChrome() {
    const profileButton = document.querySelector("#profile-button");
    const centerButton = document.querySelector("#account-center-trigger");
    const accountDialog = document.querySelector("#account-dialog");
    profileButton.addEventListener("click", () => this.openProfile());
    centerButton.addEventListener("click", () => this.showAccountCenter());
    document.querySelector("#logout-button").addEventListener("click", () => this.logout());
    this.dialog.addEventListener("cancel", (event) => {
      if (this.dialog.dataset.requiredChoice === "true") event.preventDefault();
    });
    this.dialog.addEventListener("close", () => this.stopCamera());
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      if (this.dialog.dataset.requiredChoice === "true") event.preventDefault();
      else this.closeDialog();
    });
    accountDialog.addEventListener("click", (event) => { if (event.target === accountDialog) accountDialog.close(); });
  }

  refreshChrome() {
    const account = this.isAuthenticated();
    const name = account ? this.user.username : "Guest";
    document.querySelector("#sidebar-user-name").textContent = name;
    document.querySelector("#sidebar-user-label").textContent = account ? "Local profile" : "Browsing quietly";
    document.querySelector("#account-avatar").textContent = this.initial(name);
    document.querySelector("#profile-button").setAttribute("aria-label", account ? `${name}. Open account center` : "Guest. Open account options");
    document.querySelector("#account-center-trigger").hidden = !account;
    document.querySelector("#logout-button").hidden = !account;
    const favoriteCount = document.querySelector("#favorite-count");
    favoriteCount.textContent = String(this.favoriteIds.size);
    favoriteCount.hidden = !this.favoriteIds.size;
    document.querySelector("#account-center-trigger").title = "Account Center";
  }

  restoreSession() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(STORAGE.localSession) || "null"); } catch { /* Ignore unreadable local storage. */ }
    if (!session) {
      try { session = JSON.parse(sessionStorage.getItem("ghostly.session.temporary.v1") || "null"); } catch { /* Ignore unreadable session storage. */ }
    }
    if (session?.mode === "guest") return { mode: "guest", username: "Guest" };
    if (session?.mode === "account" && ID_PATTERN.test(session.id || "")) {
      const account = this.readAccounts().find((item) => item.id === session.id);
      if (account) return { mode: "account", id: account.id, username: account.username };
    }
    return null;
  }

  saveSession(user, remember) {
    try { localStorage.removeItem(STORAGE.localSession); sessionStorage.removeItem("ghostly.session.temporary.v1"); } catch { /* Storage may be disabled. */ }
    try {
      const value = JSON.stringify(user);
      if (remember || user.mode === "guest") localStorage.setItem(STORAGE.localSession, value);
      else sessionStorage.setItem("ghostly.session.temporary.v1", value);
    } catch { this.notify("This browser could not save the session. You can still browse this page."); }
  }

  hasRememberedSession() {
    try { return Boolean(localStorage.getItem(STORAGE.localSession)); } catch { return false; }
  }

  markOnboardingDone() { try { localStorage.setItem(STORAGE.onboarding, "true"); } catch { /* A session can still continue without storage. */ } }

  readAccounts() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE.accounts) || "[]");
      return Array.isArray(data) ? data.filter((item) => item && ID_PATTERN.test(item.id || "") && typeof item.username === "string") : [];
    } catch { return []; }
  }

  writeAccounts(accounts) {
    try { localStorage.setItem(STORAGE.accounts, JSON.stringify(accounts)); return true; }
    catch { return false; }
  }

  generateUniqueId() {
    if (!globalThis.crypto?.getRandomValues) throw new Error("A secure browser context is needed to generate an account ID. Open the site over HTTPS or localhost.");
    const saved = new Set(this.readAccounts().map((account) => account.id));
    for (let attempt = 0; attempt < 30; attempt += 1) {
      let id = "";
      while (id.length < 20) {
        const bytes = new Uint8Array(32);
        globalThis.crypto.getRandomValues(bytes);
        for (const byte of bytes) if (byte < 252 && id.length < 20) id += ALPHABET[byte % ALPHABET.length];
      }
      if (!saved.has(id)) return id;
    }
    throw new Error("A unique ID could not be created. Try again.");
  }

  loadFavorites() {
    this.favoriteIds.clear();
    const key = this.favoriteStorageKey();
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved)) saved.filter((id) => typeof id === "string").forEach((id) => this.favoriteIds.add(id));
    } catch { /* Start with an empty local list. */ }
  }

  saveFavorites() {
    try { localStorage.setItem(this.favoriteStorageKey(), JSON.stringify([...this.favoriteIds])); }
    catch { this.notify("This browser couldn’t save favourites just now."); }
  }

  favoriteStorageKey() { return this.isAuthenticated() ? `ghostly.favorites.${this.user.id}` : "ghostly.favorites.guest"; }
  initial(username) { return Array.from(String(username || "G").trim())[0]?.toLocaleUpperCase() || "G"; }

  async copyText(text) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); this.notify("Copied to clipboard."); }
    catch { this.notify("Clipboard access is unavailable here. Select and copy the ID manually."); }
  }

  downloadQr(canvas, id) {
    if (!canvas || !id) return;
    try {
      const anchor = el("a");
      anchor.download = `ghostly-${id.slice(0, 6).toLowerCase()}-qr.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();
      playUiSound("download");
      this.notify("QR image saved to your device.");
    } catch { this.notify("This browser couldn’t save the QR image."); }
  }

  stopCamera() {
    if (this.scanTimer) window.clearTimeout(this.scanTimer);
    this.scanTimer = null;
    if (this.cameraStream) this.cameraStream.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
  }
}

function methodButton(title, description, svg) {
  const button = el("button", "login-method");
  button.type = "button";
  button.append(iconSvg(svg), el("strong", "", title), el("small", "", description));
  return button;
}

function closeButton(action) {
  const button = el("button", "dialog-close");
  button.type = "button";
  button.setAttribute("aria-label", "Close dialog");
  button.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg>";
  button.addEventListener("click", action);
  return button;
}

function iconSvg(paths) {
  const span = el("span", "choice-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24">${paths}</svg>`;
  return span;
}

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}




