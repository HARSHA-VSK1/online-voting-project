'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class adminModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    resetPass(password) {
      return this.update({ password });
    }

    static createAdmin({ firstName, lastName, email, password }) {
      return this.create({
        firstName,
        lastName,
        email,
        password,
      });
    }

    static associate(models) {
      // define association here
      adminModel.hasMany(models.electionModel, {
        foreignKey: "adminID",
      });
    }
  }
  adminModel.init({
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    password: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: "admin",
    },
  }, {
    sequelize,
    modelName: 'adminModel',
  });
  return adminModel;
};