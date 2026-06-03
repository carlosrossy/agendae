import { UniqueId } from "./id";

export interface EntityProps {
  readonly id: UniqueId;
  readonly createdAt: Date;
  updatedAt: Date;
}

export abstract class Entity<TProps extends EntityProps> {
  protected props: TProps;

  protected constructor(props: TProps) {
    this.props = props;
  }

  public get id(): UniqueId {
    return this.props.id;
  }

  public get createdAt(): Date {
    return new Date(this.props.createdAt.getTime());
  }

  public get updatedAt(): Date {
    return new Date(this.props.updatedAt.getTime());
  }

  public equals(other?: Entity<TProps> | null): boolean {
    if (other === null || other === undefined) return false;
    if (other === this) return true;
    if (other.constructor !== this.constructor) return false;
    return this.id === other.id;
  }

  protected touch(): void {
    this.props.updatedAt = new Date();
  }
}
