import * as fs from 'fs';
import * as path from 'path';

import { stripIndents } from '@angular-devkit/core/src/utils/literals';

import { updateJsonFile, readCliConfigFile } from '../utils/fileutils';

type Migration = { description: string; run(): void };
type MigrationName = { name: string; migration: Migration };

export function update(args: string[]) {
  const allMigrations = readAllMigrations();
  const latestMigration = readLatestMigration();
  const migrationsToRun = calculateMigrationsToRun(
    allMigrations,
    latestMigration
  );

  const command = args[0];
  switch (command) {
    case 'check':
      check(latestMigration, migrationsToRun);
      break;

    case 'skip':
      skip(latestMigration, migrationsToRun);
      break;

    default:
      run(latestMigration, migrationsToRun);
      break;
  }
}

function readAllMigrations() {
  return fs
    .readdirSync(path.join(__dirname, '/../../migrations/legacy-migrations'))
    .filter(f => f.endsWith('.js') && !f.endsWith('.d.js'))
    .map(file => ({
      migration: require(`../../migrations/legacy-migrations/${file}`).default,
      name: path.parse(file).name
    }));
}

function readLatestMigration(): string {
  if (!fs.existsSync('.angular-cli.json') && fs.existsSync('angular.json')) {
    return 'ANGULAR CLI 6';
  }
  const angularCli = readCliConfigFile();
  return angularCli.project.latestMigration;
}

function calculateMigrationsToRun(
  migrations: MigrationName[],
  latestMigration: string
) {
  if (latestMigration === 'ANGULAR CLI 6') {
    console.error(stripIndents`
      Nx update is now deprecated.
      Please use "ng update @nrwl/schematics" instead.
    `);
    process.exit(1);
  }
  const startingWith = latestMigration
    ? migrations.findIndex(item => item.name === latestMigration) + 1
    : 0;
  return migrations.slice(startingWith);
}

function skip(latestMigration: string, migrations: MigrationName[]): void {
  if (migrations.length === 0) {
    process.exit(0);
  }

  updateLatestMigration(migrations);

  console.log('The following migrations have been skipped:');
  migrations.forEach(m => {
    console.log(`- ${m.name}`);
  });

  const target = migrations[migrations.length - 1].name;
  console.log(
    `The latestMigration property in .angular-cli.json has been set to "${target}".`
  );
}

function check(latestMigration: string, migrations: MigrationName[]): void {
  if (migrations.length === 0) {
    process.exit(0);
  }

  console.log(
    '-----------------------------------------------------------------------------'
  );
  console.log(
    '-------------------------------IMPORTANT!!!----------------------------------'
  );
  console.log(
    '-----------------------------------------------------------------------------'
  );
  console.log('Run "npm run update" to run the following migrations:');
  migrations.forEach(m => {
    console.log(`- ${m.name}`);
    console.log(m.migration.description);
    console.log(
      '-----------------------------------------------------------------------------'
    );
  });

  const target = migrations[migrations.length - 1].name;
  console.log(
    `Or run "npm run update:skip" to set the latestMigration property`
  );
  console.log(`in .angular-cli.json to: "${target}".`);
}

function run(latestMigration: string, migrations: MigrationName[]): void {
  if (migrations.length === 0) {
    console.log('No migrations to run');
    process.exit(0);
  }

  migrations.forEach(m => {
    try {
      console.log(`Running ${m.name}`);
      console.log(m.migration.description);
      m.migration.run();
      console.log(
        '-----------------------------------------------------------------------------'
      );
    } catch (e) {
      console.error(`Migration ${m.name} failed`);
      console.error(e);
      console.error(`Please run 'git checkout .'`);
      process.exit(1);
    }
  });

  updateLatestMigration(migrations);

  console.log(`The following migrations have been run:`);
  migrations.forEach(m => {
    console.log(`- ${m.name}`);
  });

  const target = migrations[migrations.length - 1].name;
  console.log(
    `The latestMigration property in .angular-cli.json has been set to "${target}".`
  );
}

function updateLatestMigration(migrations: MigrationName[]): void {
  try {
    // we must reread .angular-cli.json because some of the migrations could have modified it
    updateJsonFile('.angular-cli.json', angularCliJson => {
      angularCliJson.project.latestMigration =
        migrations[migrations.length - 1].name;
    });
  } catch (e) {}
}
