type ClassValue =
  | string
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

const appendClass = (input: ClassValue, classes: string[]) => {
  if (!input) {
    return;
  }

  if (typeof input === "string") {
    classes.push(input);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      appendClass(item, classes);
    }
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      classes.push(key);
    }
  }
};

export const cn = (...inputs: ClassValue[]) => {
  const classes: string[] = [];

  for (const input of inputs) {
    appendClass(input, classes);
  }

  return classes.join(" ");
};
