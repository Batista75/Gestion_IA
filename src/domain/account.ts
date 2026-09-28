const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readAccountDraft(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
}):
  | { firstName: string; lastName: string; email: string; password: string }
  | { error: string } {
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  const email = input.email.trim().toLowerCase();
  if (!firstName || !lastName) return { error: "Indiquez le prénom et le nom. Ils signeront les modifications." };
  if (!EMAIL.test(email) || email.length > 120) {
    return { error: "Indiquez une adresse e-mail, par exemple prenom@atelier.local." };
  }
  const password = passwordError(input.password, input.confirm);
  if (password) return { error: password };
  return { firstName, lastName, email, password: input.password };
}

export function readLogin(input: { email: string; password: string }): { email: string; password: string } | { error: string } {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return { error: "Indiquez l’adresse e-mail et le mot de passe." };
  }
  return { email, password: input.password };
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function passwordError(password: string, confirm: string): string {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (password.length > 200) return "Le mot de passe est trop long. Raccourcissez-le à 200 caractères.";
  if (password !== confirm) return "Les deux mots de passe sont différents. Saisissez le même dans les deux champs.";
  return "";
}
