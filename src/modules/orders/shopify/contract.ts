import { SyncFailure } from "./types";
export type Graph = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
interface Ref {
  kind: string;
  name?: string | null;
  ofType?: Ref | null;
}
interface Field {
  name: string;
  type: Ref;
  defaultValue?: string | null;
}
interface Type {
  kind: string;
  inputFields?: Field[];
  enumValues?: { name: string }[];
  fields?: { name: string; args: Field[] }[];
}
const REF =
  "kind name ofType { kind name ofType { kind name ofType { kind name } } }";
// No static schema assumptions can authorize a mutation. Validate its complete payload
// and required fields against the schema returned by this exact API version first.
export class OrderContract {
  private cache = new Map<string, Type>();
  constructor(private graph: Graph) {}
  async type(name: string): Promise<Type> {
    let t = this.cache.get(name);
    if (!t) {
      const data = await this.graph(
        `query DzOrderType($name:String!) { __type(name:$name) { kind inputFields { name defaultValue type { ${REF} } } enumValues { name } fields { name args { name defaultValue type { ${REF} } } } } }`,
        { name },
      );
      t = data.__type as Type;
      if (!t) throw new SyncFailure("SCHEMA_UNSUPPORTED");
      this.cache.set(name, t);
    }
    return t;
  }
  async validate(value: unknown, ref: Ref): Promise<void> {
    if (ref.kind === "NON_NULL") {
      if (value === undefined || value === null)
        throw new SyncFailure("SCHEMA_REQUIRED_FIELD");
      return this.validate(value, ref.ofType!);
    }
    if (value === null || value === undefined) return;
    if (ref.kind === "LIST") {
      if (!Array.isArray(value)) throw new SyncFailure("SCHEMA_INVALID_LIST");
      for (const item of value) await this.validate(item, ref.ofType!);
      return;
    }
    if (ref.kind === "SCALAR") {
      if (ref.name === "Boolean" && typeof value !== "boolean")
        throw new SyncFailure("SCHEMA_INVALID_SCALAR");
      if (
        ["String", "ID", "Decimal"].includes(ref.name ?? "") &&
        typeof value !== "string"
      )
        throw new SyncFailure("SCHEMA_INVALID_SCALAR");
      if (
        ["Int", "Float"].includes(ref.name ?? "") &&
        (typeof value !== "number" || !Number.isFinite(value))
      )
        throw new SyncFailure("SCHEMA_INVALID_SCALAR");
      return;
    }
    const t = await this.type(ref.name!);
    if (t.kind === "ENUM") {
      if (!t.enumValues?.some((e) => e.name === value))
        throw new SyncFailure("SCHEMA_INVALID_ENUM");
      return;
    }
    if (
      t.kind !== "INPUT_OBJECT" ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      throw new SyncFailure("SCHEMA_INVALID_INPUT");
    const fields = t.inputFields ?? [];
    const object = value as Record<string, unknown>;
    if (Object.keys(object).some((key) => !fields.some((f) => f.name === key)))
      throw new SyncFailure("SCHEMA_UNSUPPORTED_FIELD");
    for (const f of fields)
      if (
        f.name in object ||
        (f.type.kind === "NON_NULL" && f.defaultValue == null)
      )
        await this.validate(object[f.name], f.type);
  }
  async mutation(
    order: Record<string, unknown>,
    options: Record<string, unknown>,
  ) {
    const mutation = (await this.type("Mutation")).fields?.find(
      (f) => f.name === "orderCreate",
    );
    if (!mutation) throw new SyncFailure("SCHEMA_ORDER_CREATE_MISSING");
    const args = { order, options };
    for (const name of ["order", "options"] as const) {
      const f = mutation.args.find((a) => a.name === name);
      if (!f) throw new SyncFailure("SCHEMA_UNSUPPORTED");
      await this.validate(args[name], f.type);
    }
    for (const arg of mutation.args)
      if (
        !(arg.name in args) &&
        arg.type.kind === "NON_NULL" &&
        arg.defaultValue == null
      )
        throw new SyncFailure("SCHEMA_REQUIRED_ARGUMENT");
  }
  async hasSourceIdentifier() {
    return (
      !!(await this.type("OrderCreateOrderInput")).inputFields?.some(
        (f) => f.name === "sourceIdentifier",
      ) &&
      !!(await this.type("Order")).fields?.some(
        (f) => f.name === "sourceIdentifier",
      )
    );
  }
}
