import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity()
export class KeyValuePair {
  @PrimaryColumn("text")
  blockHash!: string

  @PrimaryColumn("text")
  key!: string

  @Column("text",{ nullable: true })
  value!: string
}
