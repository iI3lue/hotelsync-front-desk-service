import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding front-desk database...");

  // Seed opcional: si hay una reserva real, pasar su ID por SEED_BOOKING_ID
  // para dejar una asignación demo. Sin FK entre DBs no se valida acá.
  const demoBookingId = process.env.SEED_BOOKING_ID;

  if (demoBookingId) {
    await prisma.roomAssignment.create({
      data: {
        booking_id: demoBookingId,
        physical_room_number: "101",
      },
    });
    console.log(`Demo assignment created for booking ${demoBookingId}.`);
  } else {
    console.log("No SEED_BOOKING_ID provided, skipping demo assignment.");
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
