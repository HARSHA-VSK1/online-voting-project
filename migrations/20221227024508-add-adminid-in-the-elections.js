'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
     await queryInterface.addColumn("electionModels", "adminID", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("electionModels", {
      fields: ["adminID"],
      type: "foreign key",
      references: {
        table: "adminModels",
        field: "id",
      },
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
     await queryInterface.removeColumn("electionModels", "adminID");
  }
};
