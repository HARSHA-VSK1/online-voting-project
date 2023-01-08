'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class questionsModel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static async getNumOfQues(electionID) {
      return await this.count({
        where: {
          electionID,
        },
      });
    }

    static updateaQuestion({ QuestionName, Description, id }) {
      return this.update(
        {
          QuestionName,
          Description,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static addaaQuestion({ QuestionName, Description, electionID }) {
      return this.create({
        QuestionName,
        Description,
        electionID,
      });
    }

    static async getaQuestion(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static deleteaQuestion(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static async getAllQuestions(electionID) {
      return await this.findAll({
        where: {
          electionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static associate(models) {
      // define association here
      questionsModel.belongsTo(models.electionModel, {
        foreignKey: "electionID",
      });

      questionsModel.hasMany(models.optionModel, {
        foreignKey: "questionID",
      });
    }
  }
  questionsModel.init({
    QuestionName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'questionsModel',
  });
  return questionsModel;
};