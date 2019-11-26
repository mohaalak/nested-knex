import knex from 'knex';
import nestHydrationJS from 'nesthydrationjs';

const NestHydrationJS = nestHydrationJS();

abstract class Type<A> {
  public readonly _A: A;

  public withQuery(q: knex.QueryBuilder): Promise<A> {
    return q.select(this.getSelect()).then(x => NestHydrationJS.nest(x, this.getDefinition()));
  }
  public abstract getDefinition(): any;

  public abstract getSelect(): string[];
}

type TypeOf<C extends Type<any>> = C['_A'];

const alias = (field: string): string => field.replace(/\./g, '_');
const flatten = <A>(arr: A[][]): A[] => [].concat.apply([], arr);

export interface Props {
  [key: string]: Type<any>;
}

// tslint:disable-next-line: max-classes-per-file
class ValueType<A> extends Type<A> {
  public static of<A>(field: string, option: TransformOption = { id: false }) {
    return new ValueType<A>(field, option);
  }

  constructor(protected field: string, private option: TransformOption) {
    super();
  }

  public getDefinition() {
    return { column: alias(this.field), id: this.option.id };
  }

  public getSelect() {
    return [`${this.field} as ${alias(this.field)}`];
  }
}

class ArrayType<C extends Type<any>> extends Type<Array<TypeOf<C>>> {
  constructor(private value: C) {
    super();
  }

  public getDefinition() {
    return [this.value.getDefinition()];
  }

  public getSelect() {
    return this.value.getSelect();
  }
}

class TypeType<P extends Props> extends Type<{ [K in keyof P]: TypeOf<P[K]> }> {
  constructor(private value: P) {
    super();
  }

  public getDefinition() {
    return Object.keys(this.value).reduce((prev: any, curr: string) => {
      prev[curr] = this.value[curr].getDefinition();
      return prev;
    }, {});
  }

  public getSelect() {
    return flatten(Object.keys(this.value).map(k => this.value[k].getSelect()));
  }
}

class NullableType<P extends Props> extends Type<{ [K in keyof P]: TypeOf<P[K]> } | null> {
  constructor(private value: P) {
    super();
  }

  public getDefinition() {
    return Object.keys(this.value).reduce((prev: any, curr: string) => {
      prev[curr] = this.value[curr].getDefinition();
      return prev;
    }, {});
  }

  public getSelect() {
    return flatten(Object.keys(this.value).map(k => this.value[k].getSelect()));
  }
}

interface TransformOption {
  id: boolean;
}

export const nullableType = <P extends Props>(v: P) => new NullableType(v);
export const type = <P extends Props>(v: P) => new TypeType(v);
export const number = (field: string, option?: TransformOption): Type<number> => ValueType.of<number>(field, option);
export const string = (field: string, option?: TransformOption): Type<string> => ValueType.of<string>(field, option);
export const date = (field: string, option?: TransformOption): Type<Date> => ValueType.of<Date>(field, option);
export const boolean = (field: string, option?: TransformOption): Type<boolean> => ValueType.of<boolean>(field, option);
export const nullableNumber = (field: string) => ValueType.of<number | null>(field, { id: false });
export const nullableString = (field: string) => ValueType.of<string | null>(field, { id: false });
export const nullableDate = (field: string) => ValueType.of<Date | null>(field, { id: false });
export const array = <C extends Type<any>>(v: C) => new ArrayType(v);
