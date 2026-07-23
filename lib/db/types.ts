export type SerializableDate = string;
export type SerializableDecimal = string;

export type DbHealth = {
  ok: boolean;
  provider: "postgresql";
  checkedAt: string;
  error?: string;
};
