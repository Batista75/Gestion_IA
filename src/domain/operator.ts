export const defaultOperator = {
  firstName: "Jhon",
  lastName: "Smith",
  passwordRequired: false,
};

export function operatorMark(firstName: string, lastName: string): string {
  const initial = [...firstName.trim()][0]?.toLocaleUpperCase("fr-FR") ?? "";
  const family = lastName.trim();
  if (!initial || !family) return "";
  return `${initial} ${family}`;
}

export function currentOperatorMark(): string {
  return operatorMark(defaultOperator.firstName, defaultOperator.lastName);
}
