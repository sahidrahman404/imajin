import { Migration } from '@mikro-orm/migrations';

export class Migration20251111163706 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`category\` (\`id\` integer not null primary key autoincrement, \`name\` text not null, \`description\` text null, \`created_at\` datetime not null);`);
    this.addSql(`create unique index \`category_name_unique\` on \`category\` (\`name\`);`);

    this.addSql(`create table \`product\` (\`id\` integer not null primary key autoincrement, \`name\` text not null, \`description\` text null, \`price\` integer not null, \`category_id\` integer not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`product_category_id_foreign\` foreign key(\`category_id\`) references \`category\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`product_category_id_index\` on \`product\` (\`category_id\`);`);

    this.addSql(`create table \`user\` (\`id\` integer not null primary key autoincrement, \`email\` text not null, \`password\` text not null, \`created_at\` datetime not null, \`updated_at\` datetime not null);`);
    this.addSql(`create unique index \`user_email_unique\` on \`user\` (\`email\`);`);

    this.addSql(`create table \`session\` (\`id\` integer not null primary key autoincrement, \`session_id\` text not null, \`user_id\` integer not null, \`expires_at\` datetime not null, \`created_at\` datetime not null, constraint \`session_user_id_foreign\` foreign key(\`user_id\`) references \`user\`(\`id\`) on update cascade);`);
    this.addSql(`create unique index \`session_session_id_unique\` on \`session\` (\`session_id\`);`);
    this.addSql(`create index \`session_user_id_index\` on \`session\` (\`user_id\`);`);

    this.addSql(`create table \`order\` (\`id\` integer not null primary key autoincrement, \`user_id\` integer not null, \`total\` integer not null, \`status\` text not null default 'pending', \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`order_user_id_foreign\` foreign key(\`user_id\`) references \`user\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`order_user_id_index\` on \`order\` (\`user_id\`);`);

    this.addSql(`create table \`order_item\` (\`id\` integer not null primary key autoincrement, \`order_id\` integer not null, \`product_id\` integer not null, \`quantity\` integer not null, \`price\` integer not null, \`created_at\` datetime not null, constraint \`order_item_order_id_foreign\` foreign key(\`order_id\`) references \`order\`(\`id\`) on update cascade, constraint \`order_item_product_id_foreign\` foreign key(\`product_id\`) references \`product\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`order_item_order_id_index\` on \`order_item\` (\`order_id\`);`);
    this.addSql(`create index \`order_item_product_id_index\` on \`order_item\` (\`product_id\`);`);

    this.addSql(`create table \`cart\` (\`id\` integer not null primary key autoincrement, \`user_id\` integer not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`cart_user_id_foreign\` foreign key(\`user_id\`) references \`user\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`cart_user_id_index\` on \`cart\` (\`user_id\`);`);

    this.addSql(`create table \`cart_item\` (\`id\` integer not null primary key autoincrement, \`cart_id\` integer not null, \`product_id\` integer not null, \`quantity\` integer not null, \`created_at\` datetime not null, \`updated_at\` datetime not null, constraint \`cart_item_cart_id_foreign\` foreign key(\`cart_id\`) references \`cart\`(\`id\`) on update cascade, constraint \`cart_item_product_id_foreign\` foreign key(\`product_id\`) references \`product\`(\`id\`) on update cascade);`);
    this.addSql(`create index \`cart_item_cart_id_index\` on \`cart_item\` (\`cart_id\`);`);
    this.addSql(`create index \`cart_item_product_id_index\` on \`cart_item\` (\`product_id\`);`);
  }

}
