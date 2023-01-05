'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class voterModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
     resetPass(password) {
      return this.update({ password });
    }

    static async createVoter({ VoterID, Password, electionID }) {
      return await this.create({
        VoterID,
        Password,
        electionID,
        VotedOrNot: false,
      });
    }

    static async getNumberOfVoters(electionID) {
      return await this.count({
        where: {
          electionID,
        },
      });
    }

    static async getVoters(electionID) {
      return await this.findAll({
        where: {
          electionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static async getVoter(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static async deleteVoter(id) {
      return await this.destroy({
        where: {
          id,
        },
      });
    }

    static associate(models) {
      // define association here
      voterModel.belongsTo(models.electionModel, {
        foreignKey: "electionID",
      });
    }
  }
  voterModel.init({
    VoterID: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    VotedOrNot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    Role: {
      type: DataTypes.STRING,
      defaultValue: "voter",
    },
  }, {
    sequelize,
    modelName: 'voterModel',
  });
  return voterModel;
};