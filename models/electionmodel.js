'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class electionModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
     static addElection({ ElectionName, adminID, url }) {
      return this.create({
        ElectionName,
        url,
        adminID,
      });
    }

    static launchElection(id) {
      return this.update(
        {
          Launch: true,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static getElections(adminID) {
      return this.findAll({
        where: {
          adminID,
        },
        order: [["id", "ASC"]],
      });
    }

    static getElection(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }

    static getElectionURL(url) {
      return this.findOne({
        where: {
          url,
        },
      });
    }

    static associate(models) {
      // define association here
      electionModel.belongsTo(models.adminModel, {
        foreignKey: "adminID",
      });

      electionModel.hasMany(models.questionsModel, {
        foreignKey: "electionID",
      });

      electionModel.hasMany(models.voterModel, {
        foreignKey: "electionID",
      });
    }
  }
  electionModel.init({
    ElectionName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Launch: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    Stop: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'electionModel',
  });
  return electionModel;
};