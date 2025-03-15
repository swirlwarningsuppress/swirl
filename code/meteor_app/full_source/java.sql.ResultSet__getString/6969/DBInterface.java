/*
	   Copyright (C) 2005-2006 Sergey Koposov
   
    Author: Sergey Koposov
    Email: math@sai.msu.ru 
    http://lnfm1.sai.msu.ru/~math

    This file is part of SAI CAS

    SAI CAS is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    SAI CAS is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with SAI CAS; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/


package sai_cas.db;

import java.sql.*;
import java.util.List;
import java.util.ArrayList;
import java.util.ListIterator;

import org.apache.log4j.Logger;
import org.postgresql.*;


public class DBInterface
{
	static Logger logger = Logger.getLogger("sai_cas.DBInterface");
	private PreparedStatement pstmtBuffered;
	private StatementSetter[] ss;
	public QueryResults qr;
	private Connection conn;
	Statement stmt;
	final int maxBatchStatement = 1000;
	int curNBatchStatements;
	String userLogged = null;

	
	public DBInterface(Connection conn) throws java.sql.SQLException
	{
		this.conn = conn;
		
		String query = "SET search_path TO cas_metadata, public;";
		stmt = conn.createStatement(); 
		stmt.execute(query);
		logger.info("The DB interface is successfully created...");
		curNBatchStatements = 0 ;
	}

	/* TODO need to be refactored (concerning user_schema) */
	public DBInterface(Connection conn, String user) throws java.sql.SQLException
	{
		this.conn = conn;
		String userSchema;
		String query;
		if (!user.equals("admin"))
		{
			userLogged = getInternalLoginName(user);
			stmt = conn.createStatement();
			userSchema = this.getUserMetaDataSchemaName() ; 
			query = "SET search_path TO " + userSchema + ", cas_metadata, public;";
		}
		else
		{
			stmt = conn.createStatement();
			query = "SET search_path TO  cas_metadata, public;";		
		}
		stmt.execute(query);
		logger.info("The DB interface is successfully created...");
		curNBatchStatements = 0;
	}


	public void close()
	{
		close(true);
	}

	/**
	 * Close the {@link DBInterface}
	 * @param commit_flag
	 */
	public void close(boolean commit_flag)
	{
		logger.debug("The DB interface is being closed...");
		try
		{
			if (stmt != null)
			{
				stmt.close();
			}
			if (qr != null)
			{
				qr.close();
			}
			if (commit_flag)
			{
				conn.commit();
			}
			else 
			{
				conn.rollback();
			}
			conn.close();
		}
		catch (SQLException e)
		{
			logger.error("Exception during DBInterface closing ... " + e + e.getCause());
		}
	}

	public static void close(DBInterface dbi, Connection conn)
	{
		close(dbi,conn,true);	
	}
	
	public static void close(DBInterface dbi, Connection conn, boolean commit_flag)
	{
		try 
		{
			if (dbi != null)
			{
				dbi.close(commit_flag);
			}
			else if (conn != null)
			{
				logger.debug("The DB interface is being closed...");

				if (commit_flag)
				{
					conn.commit();
				}
				else
				{
					conn.rollback();
				}
				conn.close();
			}
		}
		catch(SQLException e)
		{			
		}
	}

	/**
	 * Flush the SQL commands staying the buffer of the batch execution
	 * (used during the batch inserts)
	 * @throws SQLException
	 */
	public void flushData() throws SQLException
	{
		if (pstmtBuffered != null)
		{
			pstmtBuffered.executeBatch();
			pstmtBuffered.close();
			pstmtBuffered = null;
		}
	}

	public void insertCatalog(String catalog) throws SQLException
	{
		String query = "INSERT INTO catalog_list (name) VALUES ('" + catalog + "')";
		stmt.execute(query);     
		query = "CREATE SCHEMA "+catalog;
		stmt.execute(query);            
	}

	public void prepareInsertingData(String catalog, String table, String[] datatypeArray) throws SQLException, DBException
	{
		String[] internalDatatypeArray = new String[datatypeArray.length];

		for (int i = 0; i < datatypeArray.length; i++)
		{	
			internalDatatypeArray[i] = getInternalDatatype(datatypeArray[i]);
		}
		
		StringBuffer query =  new StringBuffer(1000);
		query.append("INSERT INTO " + catalog + "." + table + " VALUES (");
		
		ss = new StatementSetter[internalDatatypeArray.length];
		for(int i = 0, len = internalDatatypeArray.length; i < len; i++)
		{
			if (internalDatatypeArray[i].equals( "varchar"))
				ss[i] = new StatementSetterVarchar();
			else if (internalDatatypeArray[i].equals( "integer"))
				ss[i] = new StatementSetterInt();
			else if (internalDatatypeArray[i].equals( "smallint"))
				ss[i] = new StatementSetterInt();
			else if (internalDatatypeArray[i].equals( "double precision"))
				ss[i] = new StatementSetterDouble();
			else if (internalDatatypeArray[i].equals( "real"))
				ss[i] = new StatementSetterFloat();
			else if (internalDatatypeArray[i].equals( "bigint"))
				ss[i] = new StatementSetterLong();
			else if (internalDatatypeArray[i].equals( "boolean"))
				ss[i] = new StatementSetterBoolean();
			else 
				ss[i] = new StatementSetter(internalDatatypeArray[i]);
			query.append(ss[i].getInsert());
		}
		query.setCharAt(query.length() - 1, ')');		
		pstmtBuffered = conn.prepareStatement(query.toString());
		//org.postgresql.PGStatement pgstmt = 
//		((org.postgresql.PGStatement)pstmtBuffered).setPrepareThreshold(3);
		for(int i = 0, len = internalDatatypeArray.length; i < len; i++)
		{
			ss[i].setStatement(pstmtBuffered);
		}
	}	

	private class StatementSetter
	{
		String datatype;
		public StatementSetter (String datatype)
		{
			this.datatype = datatype;
		}
		public StatementSetter ()
		{
		}
		public void setStatement (PreparedStatement pstmt)
		{
			this.pstmt = pstmt;
		}		
		public void set(int i, String value) throws java.sql.SQLException
		{
			pstmt.setString(i,value);
		}
		public String getInsert()
		{
			return "CAST(? AS " + datatype + "),";
		}
		protected PreparedStatement pstmt;	
	}
	
	private class StatementSetterInt extends StatementSetter
	{
		public void set(int i, String value) throws java.sql.SQLException
		{
			String value1 = value.trim();
			if (value1.length() == 0)
			{
				pstmt.setNull(i,Types.INTEGER);
				return;
			}
			int offset = 0;
			if (value1.charAt(0) == '+')
			{
					offset = 1;
			}			
			pstmt.setInt(i, Integer.parseInt(value1.substring(offset)));
		}
		public String getInsert()
		{
			return "?,";
		}		
	}

	private class StatementSetterLong extends StatementSetter
	{
		public void set(int i, String value) throws java.sql.SQLException
		{
			String value1 = value.trim();
			int offset = 0;
			if (value1.length() == 0)
			{
				pstmt.setNull(i, Types.BIGINT);
				return;
			}

			if (value1.charAt(0) == '+')
			{
					offset = 1;
			}
			
			pstmt.setLong(i, Long.parseLong(value1.substring(offset)));
		}
		public String getInsert()
		{
			return "?,";
		}		
	}	
	private class StatementSetterDouble extends StatementSetter
	{
/*		public StatementSetterDouble (String datatype)
		{
			super(datatype);
		}*/
		public void set(int i, String value) throws java.sql.SQLException
		{
			String value1 = value.trim();
			if (value1.length() == 0)
			{
				pstmt.setNull(i, Types.DOUBLE);
				return;
			}			
			pstmt.setDouble(i, Double.parseDouble(value1));
		}		
		public String getInsert()
		{
			return "?,";
		}
	}

	
	private class StatementSetterFloat extends StatementSetter
	{
		public void set(int i, String value) throws java.sql.SQLException
		{
			String value1 = value.trim();
			if (value1.length() == 0)
			{
				pstmt.setNull(i, Types.FLOAT);
				return;
			}			
			pstmt.setFloat(i, Float.parseFloat(value1));
		}		
		public String getInsert()
		{
			return "?,";
		}
	}

	private class StatementSetterBoolean extends StatementSetter
	{
		public void set(int i, String value) throws java.sql.SQLException
		{
			String value1 = value.trim();
			if (value1.length() == 0)
			{
				pstmt.setNull(i, Types.BOOLEAN);
				return;
			}

			if (value1.equalsIgnoreCase("t"))
			{
				pstmt.setBoolean(i, true);
			}
			else if (value1.equalsIgnoreCase("f"))
			{
				pstmt.setBoolean(i, false);
			}
			else
			{
				pstmt.setBoolean(i, Boolean.parseBoolean(value1));
			}
		}		
		public String getInsert()
		{
			return "?,";
		}
	}





	private class StatementSetterVarchar extends StatementSetter
	{
		/* !!!!!!!!!! IMPORTANT !!!!!!!!!!!!!!!!!!
		 * Currently I trim all the char[] fields
		 */
		
		public void set(int i, String value) throws java.sql.SQLException
		{
			pstmt.setString(i, value.trim());
		}
		public String getInsert()
		{
			return "?,";
		}		
	}
	public void insertData(String[] stringArray) throws SQLException
	{
//		boolean usingServerPrepare = ((org.postgresql.PGStatement)pstmtBuffered).isUseServerPrepare();
//		System.out.println(usingServerPrepare);
		for(int i=0, len = stringArray.length; i < len; i++)
		{
			ss[i].set(i + 1, stringArray[i]);
		}
		//pstmtBuffered.executeUpdate();
		pstmtBuffered.addBatch();
		if (++curNBatchStatements == maxBatchStatement)
		{
			//logger.debug("Executing batch ....");
			pstmtBuffered.executeBatch();
			curNBatchStatements = 0;
		}
	}
	
	public void insertData(String catalog, String table, String[] stringArray) throws SQLException
	{
		StringBuffer query =  new StringBuffer(1000);
		query.append("INSERT INTO "+catalog+"."+table+" VALUES (");
		for(int i=0, len = stringArray.length; i < len; i++)
		{
			query.append("'" + stringArray[i] + "',");
		}
		query.setCharAt(query.length() - 1, ')');
		try 
		{
			stmt.execute(query.toString());
		}
		catch(SQLException e)
		{
			logger.error("Error during insertion of the data: \n"+query);
			throw e;
		}
	}

	public void insertCatalog(String catalog, String catalogInfo, String catalogDescription) throws SQLException
	{
		String query = "INSERT INTO catalog_list (name, info, description) VALUES ('" +
			catalog + "','" + catalogInfo + "','" + catalogDescription + "')";
		stmt.execute(query);     
		query = "CREATE SCHEMA " + catalog;
		stmt.execute(query);
	}


	public boolean checkCatalogExists(String catalog) throws SQLException
	{
		String query="SELECT cas_catalog_exists('" + catalog + "')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}

	public boolean checkCatalogPropertyExists(String property) throws SQLException
	{
		String query="SELECT cas_catalog_property_exists('" + property + "')";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}
	/**
	 * 
	 * @param catalog -- the catalog to which the properties will be set
	 * @param property -- the property name 
	 * @param value -- the property value
	 * @throws SQLException
	 */
	public void setCatalogProperty(String catalog, String property, String value) throws SQLException
	{
		String query="INSERT INTO catalog_property_map"+
		"(property_id, catalog_id, value) VALUES"+
		"(cas_get_catalog_property_id( '" + property + "' )," +
		" cas_get_catalog_id ( '" + catalog + "' ), '" + value + "' )";
		stmt.execute(query);
	}
	/**
	 * This function just do the bulk set of properties for the catalogue
	 * @param catalog -- the name of the catalogue
	 * @param propertyList -- the list of two element arrays of property name/value pairs
	 * @throws SQLException
	 */
	public void setCatalogProperties(String catalog, List<String[]> propertyList) throws SQLException
	{
		logger.debug("Inserting catalog properties...");
		for (String[] propertyPair: propertyList)
		{
			if (checkCatalogPropertyExists(propertyPair[0]))
			{
				setCatalogProperty(catalog,propertyPair[0],propertyPair[1]);
			}
			else
			{
				/* TODO 
				 * I should handle somehow the case when the property do not
				 * exist
				 */
			}
		}
	}

	/**
	 * This function just do the bulk get of properties for the catalogue
	 * @param catalog -- the name of the catalogue
	 * @throws SQLException
	 */
	public List<String[]> getCatalogProperties(String catalog) throws SQLException
	{
		logger.debug("Getting catalog properties...");

		String []propertyPair = new String[2];
		List<String[]> propertiesList = new ArrayList<String[]>();
		String query="SELECT * FROM cas_get_catalog_properties ('"+catalog+"') as (a varchar,b varchar);";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();

		while(rs.next())
		{
			propertyPair[0]=rs.getString(1);
			propertyPair[1]=rs.getString(2);
			propertiesList.add(propertyPair);
		}
		rs.close();
		return propertiesList;
	}

	
	public void setCatalogInfo(String catalog, String info) throws SQLException
	{
		String query="UPDATE catalog_list SET info = ? WHERE" +
		" id = cas_get_catalog_id ( ? )";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1, info);
		pstmt.setString(2, catalog);
		pstmt.executeUpdate();
		pstmt.close();

	}

	public void setCatalogDescription(String catalog, String description) throws SQLException
	{
		String query="UPDATE catalog_list SET description = ? WHERE " +
		" id = cas_get_catalog_id ( ? )";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1, description);
		pstmt.setString(2, catalog);
		pstmt.executeUpdate();
		pstmt.close();
	}


	public void insertTable(String catalog, String table, List<String> columnNames, List<String> columnTypes, List<String> columnUnits, List<String> columnInfos, List<String> columnDescriptions) throws SQLException, DBException
	{
		String query = "INSERT INTO table_list (name, catalog_id) VALUES ( '"+table+"',cas_get_catalog_id('"+catalog+"') )";

		stmt.execute(query);            
		ListIterator<String> cit = columnNames.listIterator();
		ListIterator<String> columnTypesIterator = columnTypes.listIterator();
		ListIterator<String> columnUnitsIterator = columnUnits.listIterator();
		ListIterator<String> columnInfosIterator = columnInfos.listIterator();
		ListIterator<String> columnDescriptionsIterator = columnDescriptions.listIterator();

		StringBuffer sb = new StringBuffer();
		String column, columnType, columnInternalType, columnUnit, columnDescription, columnInfo;
		sb.append("CREATE TABLE "+catalog + "." + table + " ( ");

		query = "INSERT INTO attribute_list " +
		"(table_id, name ,datatype_id, unit, info, description) " +
		" VALUES (cas_get_table_id(?,?),? ,cas_get_datatype_id(?),?,?,?)";
		PreparedStatement pstmt = conn.prepareStatement(query);      

		while (cit.hasNext())
		{
			if (!columnTypesIterator.hasNext())
			{
				throw new DBException("Column and ColumnType lists have different lengths");
			}
			column = cit.next();
			columnType = columnTypesIterator.next();
			columnUnit = columnUnitsIterator.next();
			columnInfo = columnInfosIterator.next();
			columnDescription = columnDescriptionsIterator.next();

			columnInternalType = getInternalDatatype(columnType);
			
			sb.append("\""+column + "\" " + columnInternalType+",");
			
			pstmt.setString(1,catalog);      
			pstmt.setString(2,table);      
			pstmt.setString(3,column);      
			pstmt.setString(4,columnType);      
			pstmt.setString(5,columnUnit);      
			pstmt.setString(6,columnInfo);      
			pstmt.setString(7,columnDescription);      
			pstmt.execute();			
		}
		logger.debug("Finished inserting attributes");
		pstmt.close();
		sb.deleteCharAt(sb.length()-1);
		sb.append(")");

		stmt.execute(new String(sb)); 
	}

	private String getInternalDatatype(String columnType) throws SQLException, DBException {
		String query;
		ResultSet rs;
		String columnInternalType;
		query = "select cas_get_internal_datatype('" + columnType + "')";
		//stmt = conn.createStatement(); 
		rs = stmt.executeQuery(query);
		if (!rs.next()) 
		{
			throw new DBException("Unknown datatype: " + columnType);
		}
		
		columnInternalType = rs.getString(1);
		if (columnInternalType == null) 
		{
			throw new DBException("Unknown datatype: " + columnType);
		}

		rs.close();
		return columnInternalType;
	}

	public void analyze(String catalog, String  table) throws SQLException
	{
		logger.debug("Analyzing "+catalog+"."+table +" ...");
		stmt.executeUpdate("ANALYZE "+catalog+"."+table);
	}
	
	public String getUserDataSchemaName() throws SQLException
	{
		stmt.executeQuery("SELECT cas_metadata.cas_get_user_data_schema_name('"+userLogged+"')");
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}
	
	public void allowCatalogueUse(String cat) throws SQLException
	{
		stmt.executeQuery("select cas_allow_catalogue_use('"+cat+"')");
		ResultSet rs = stmt.getResultSet();
		rs.close();
	}

	public void allowTableUse(String cat, String tab) throws SQLException
	{
		stmt.executeQuery("select cas_allow_table_use('"+cat+"','"+tab+"')");
		ResultSet rs = stmt.getResultSet();
		rs.close();
	}

	public String getUserMetaDataSchemaName() throws SQLException
	{
		stmt.executeQuery("SELECT cas_metadata.cas_get_user_metadata_schema_name('"+userLogged+"')");
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}

	
	public boolean checkTableExists(String catalog, String table) throws SQLException
	{
		String query="SELECT cas_table_exists('"+catalog+"','"+table+"')";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}

	public boolean checkTablePropertyExists(String property) throws SQLException
	{
		String query="SELECT cas_table_property_exists('"+property+"')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}


	public void setTableProperty(String catalog, String table, String property, String value) throws SQLException
	{
		String query="INSERT INTO table_property_map"+
		"(property_id, table_id, value) VALUES"+
		"(cas_get_table_property_id( '" +property+"' ),"+
		" cas_get_table_id ( '"+catalog+"', '"+table+"' ), '"+value+"' )";
		stmt.execute(query);
	}

	/**
	 * This function just do the bulk set of properties for the table
	 * @param catalog -- the name of the catalogue
	 * @param table -- the name of the tabl
	 * @param propertyList -- the list of two element arrays of property name/value pairs
	 * @throws SQLException
	 */
	public void setTableProperties(String catalog, String table, List<String[]> propertyList) throws SQLException
	{
		logger.debug("Inserting table properties...");
		for (String[] propertyPair: propertyList)
		{
			if (checkTablePropertyExists(propertyPair[0]))
			{
				setTableProperty(catalog,table,propertyPair[0],propertyPair[1]);
			}
			else
			{
				/* TODO 
				 * I should handle somehow the case when the property do not
				 * exist
				 */
			}
		}
	}

	/**
	 * This function just do the bulk get of properties for the table
	 * in the catalogue
	 * @param catalog -- the name of the catalogue
	 * @throws SQLException
	 */
	public List<String[]> getTableProperties(String catalog, String table) throws SQLException
	{
		logger.debug("Getting table properties...");

		String []propertyPair = new String[2];
		List<String[]> propertiesList = new ArrayList<String[]>();
		String query="SELECT * FROM cas_get_table_properties ('"+catalog+"','"+table+"')";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();

		while(rs.next())
		{
			propertyPair[0]=rs.getString(1);
			propertyPair[1]=rs.getString(2);
			propertiesList.add(propertyPair);
		}
		rs.close();
		return propertiesList;
	}


	
	public void setTableInfo(String catalog, String table, String info) throws SQLException
	{
		String query="UPDATE table_list SET info = ? WHERE " +
		" id = cas_get_table_id (?, ?)";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1,info);
		pstmt.setString(2,catalog);
		pstmt.setString(3,table);
		pstmt.executeUpdate(); 
		pstmt.close();
	}

	public void setTableDescription(String catalog, String table, String description) throws SQLException
	{
		String query="UPDATE table_list SET description = ? WHERE " +
		" id = cas_get_table_id ( ?,? )";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1,description);
		pstmt.setString(2,catalog);
		pstmt.setString(3,table);
		pstmt.executeUpdate();
		pstmt.close();
	}



	public boolean checkAttributeExists(String catalog, String table, String attribute) throws SQLException
	{
		String query="SELECT cas_attribute_exists('"+catalog+"','"+table+"','"+attribute+"')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.first();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}

	/**
	 * This function just do the bulk get of properties for the table
	 * in the catalogue
	 * @param catalog -- the name of the catalogue
	 * @throws SQLException
	 */
	public List<String[]> getAttributeProperties(String catalog, String table, String attribute) throws SQLException
	{
		logger.debug("Getting column properties...");

		String []propertyPair = new String[2];
		List<String[]> propertiesList = new ArrayList<String[]>();
		String query="SELECT * FROM cas_get_column_properties ('"+catalog+"','"+table+"','"+attribute+"') as (a varchar, b varchar);";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();

		while(rs.next())
		{
			propertyPair[0]=rs.getString(1);
			propertyPair[1]=rs.getString(2);
			propertiesList.add(propertyPair);
		}
		rs.close();
		return propertiesList;
	}



	public boolean checkAttributePropertyExists(String property) throws SQLException
	{
		String query="SELECT cas_attribute_property_exists('"+property+"')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;
	}

	public void setAttributeProperty(String catalog, String table, String attribute, String property, String value) throws SQLException
	{
		String query="INSERT INTO attribute_property_map"+
		"(property_id, attribute_id, value) VALUES"+
		"(cas_get_attribute_property_id( '" +property+"' ),"+
		" cas_get_attribute_id ( '"+catalog+"', '"+table+"', '"+attribute+"' ), '"+value+"' )";
		stmt.execute(query);
	}

	public void setAttributeInfo(String catalog, String table, String attribute, String info) throws SQLException
	{
		String query="UPDATE attribute_list SET info = '"+ info + "'WHERE" +
		" id = cas_get_attribute_id ( '"+catalog+"','"+ table+ "','"+attribute+"')";
		stmt.executeUpdate(query);
	}

	public void setAttributeDescription(String catalog, String table, String attribute, String description) throws SQLException
	{
		String query="UPDATE attribute_list SET description = ? WHERE" +
		" id = cas_get_attribute_id ( ?, ? ,? )";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1,description);
		pstmt.setString(2,catalog);
		pstmt.setString(3,table);
		pstmt.setString(4,attribute);
		pstmt.executeUpdate();
		pstmt.close();
	}


	public void setUnit (String catalog, String table, String column, String unit) throws SQLException
	{
		
		String query = "UPDATE attribute_list SET unit = ? where id="+
		"cas_get_attribute_id(? ,? ,?)";
		PreparedStatement pstmt = conn.prepareStatement(query); 
		pstmt.setString(1,unit);
		pstmt.setString(2,catalog);
		pstmt.setString(3,table);
		pstmt.setString(4,column);
		pstmt.execute();
		pstmt.close();
	}

	public boolean checkUcdExists(String ucd) throws SQLException
	{
		String query="SELECT cas_ucd_exists('"+ucd+"')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;		
	}
	/** Checks whether the UCD exists in the list of user UCDs (not system-wide UCD)
	 * 
	 * @param ucd
	 * @return boolean
	 * @throws SQLException
	 */
	public boolean checkUserUcdExists(String ucd) throws SQLException
	{
		String query="SELECT cas_user_ucd_exists('"+ucd+"')";
		stmt.executeQuery(query);            
		ResultSet rs = stmt.getResultSet();
		rs.next();
		boolean result = rs.getBoolean(1);
		rs.close();
		return result;		
	}

	
	public void setUcds (String catalog, String table, List<String> columnList,
			List<String> ucdList) throws SQLException
	{
		
		/* TODO 
		 * For whatever reason (seems to be related how the PG planner
		 * works with the prepared statements), if I run the main 
		 * UPDATE of this function as the prepared statement, it 
		 * runs as seq. scan... So I switched back to the normal
		 * statement
		 */
		ListIterator<String> columnListIterator = columnList.listIterator();
		ListIterator<String> ucdListIterator = ucdList.listIterator();
		String ucd, column;
		while(columnListIterator.hasNext())
		{
			column = columnListIterator.next(); 
			ucd = ucdListIterator.next();
			if (ucd == null)
			{
				continue;
			}
			if (((userLogged == null) && !checkUcdExists(ucd)) ||
					((userLogged != null) && !checkUserUcdExists(ucd)))
			{
				String query1 = "INSERT INTO ucd_list (name) VALUES ('" + ucd+"')";
				stmt.executeUpdate(query1);
			}
			stmt.executeUpdate ("UPDATE attribute_list SET ucd_id = cas_get_ucd_id('"+ucd+"')" +
				"WHERE id = cas_get_attribute_id('" + catalog + "','" +
				table + "','"+column+"')");
		}
		
	}

	
	public String getCatalogDescription(String catalog) throws SQLException
	{
		String query="SELECT cas_get_catalog_description('"+catalog+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}

	public String getCatalogInfo(String catalog) throws SQLException
	{
		String query="SELECT cas_get_catalog_info('"+catalog+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}

	public String[] getCatalogNames() throws SQLException
	{
		String query="SELECT cas_get_catalog_names();";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	public String getTableInfo(String catalog, String table) throws SQLException
	{
		String query="SELECT cas_get_table_info('"+catalog+"','"+table+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}

	public String getTableDescription(String catalog, String table) throws SQLException
	{
		String query="SELECT cas_get_table_description('"+catalog+"','"+table+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}



	public String[] getTableNames(String catalogName) throws SQLException
	{
		String query="SELECT cas_get_table_names('"+catalogName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	public String[] getColumnNames(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT cas_get_attribute_names('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	public String[] getColumnDescriptions(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT cas_get_column_descriptions('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	public String[] getColumnInfos(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT cas_get_column_infos('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	public String[] getColumnDatatypes(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT * FROM cas_get_column_external_datatypes('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}


	public String[] getColumnUnits(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT * FROM cas_get_column_units('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}


	public String[] getColumnUCDs(String catalogName,String tableName) throws SQLException
	{
		String query="SELECT * FROM cas_get_column_ucds('"+catalogName+"','"+tableName+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String> als = new ArrayList<String>();
		while(rs.next())
		{
			als.add(rs.getString(1));
		}
		String[] result = new String[1];
		rs.close();
		return als.toArray(result);
	}

	
	public String[][] getIndexes(String catalogName, String tableName) throws SQLException
	{
		String query="SELECT * FROM cas_get_table_indexes('" + catalogName +
			"','" + tableName + "');";
		logger.debug("Running query: "+query);
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String[]> als = new ArrayList<String[]>();
		String[] row = new String[2];
		while(rs.next())
		{
			row[0]=rs.getString(1);
			row[1]=rs.getString(2);			
			als.add(row);
		}
		String[][] result = new String[1][1];
		rs.close();
		return als.toArray(result);
	}
	
	public String[][] getUserNames() throws SQLException
	{
		String query="SELECT name, fullname from user_list;";
		logger.debug("Running query: "+query);
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String[]> als = new ArrayList<String[]>();
		while(rs.next())
		{
			String[] row = new String[2];
			row[0]=rs.getString(1);
			row[1]=rs.getString(2);			
			als.add(row);
		}
		String[][] result = new String[1][1];
		rs.close();
		return als.toArray(result);
	}
	
	public String[][] getUserNamesAndEmails() throws SQLException
	{
		String query="SELECT name, fullname, email from user_list;";
		logger.debug("Running query: "+query);
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		ArrayList<String[]> als = new ArrayList<String[]>();
		while(rs.next())
		{
			String[] row = new String[3];
			row[0]=rs.getString(1);
			row[1]=rs.getString(2);			
			row[2]=rs.getString(3);			
			als.add(row);
		}
		String[][] result = new String[1][1];
		rs.close();
		return als.toArray(result);
	}


	
	public String[] getRaDecColumns(String catalogName, String tableName) throws SQLException
	{
//		String query="?=CALL cas_get_table_ra_dec(?,?)";
		String query = "SELECT * from cas_get_table_ra_dec('"+catalogName+"','"+tableName+"')";
		logger.debug("Running query: "+query);
/*		Statement stmt = conn.prepareCall(query);
		stmt.setString(2,catalogName);
		stmt.setString(3,tableName);
		stmt.registerOutParameter(1,Types.VARCHAR);
		stmt.registerOutParameter(4,Types.VARCHAR);*/
		ResultSet rs = stmt.executeQuery(query);
		String [] res = new String[2];
		rs.next();
		res[0] = rs.getString(1);
		res[1] = rs.getString(2);
		rs.close();
		return res;
	}

	public String getColumn_ID_MAIN_UCD(String catalogName, String tableName) throws SQLException
	{
		String query="SELECT cas_get_table_id_main_ucd('" + catalogName +
			"','" + tableName + "');";
		logger.debug("Running query: "+query);
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		String result = rs.getString(1);
		rs.close();
		return result;
	}
	/**
	 * 
	 * @param catalogName
	 * @param tableName
	 * @return the name of columns having the UCD of ra & dec
	 * @throws SQLException
	 */
	public String[] getRaDecColumnsFromUCD(String catalogName, String tableName) throws SQLException
	{
		String query="SELECT * FROM cas_get_table_ra_dec_from_ucd('" + catalogName + "'," +
		"'" + tableName + "');";
		logger.debug("Running query: "+query);
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		
		if (!rs.next())
		{
			logger.debug("No columns with alpha delta columns in the table");
			return null;
		}
		
		String raDecArr[] = new String[2];
		raDecArr[0] = rs.getString(1);
		
		if (!rs.next())
		{
			logger.debug("Resultset has 1 elt");
		}

		raDecArr[1] = rs.getString(1);
		rs.close();
		return raDecArr;
	}
	
	/**
	 * @param catalogName -- The name of catalogue
	 * @return the table name if the catalogue contains only one table
	 * and null, if the catalogue has more than one table
	 */
	public String getSingleTableFromCatalog(String catalogName) throws SQLException
	{
		String tableArray[] = getTableNames(catalogName);
		if (tableArray.length > 1)
		{
			return null;
		}
		else
		{
			return tableArray[0];
		}
	}

	public long getTableCount(String catalog, String table) throws SQLException
	{
		String query="SELECT cas_approximate_count('"+catalog+"','"+table+"');";
		stmt.executeQuery(query);
		ResultSet rs = stmt.getResultSet();
		rs.next();
		long result = rs.getLong(1);
		rs.close();
		return result;
	}


	
	public void deleteTable(String catalogName, String tableName) throws SQLException
	{
		stmt.execute("select cas_delete_table('" + catalogName + "','" + tableName + "')");
	}

	public void renameTable(String catalogName, String tableName, String newTableName) throws SQLException
	{
		stmt.execute("select cas_rename_table('" + catalogName + "','" + tableName + "', '" + newTableName + "')");
	}

	public void renameColumn(String catalogName, String tableName, String columnName, String newColumnName) throws SQLException
	{
		stmt.execute("select cas_rename_column('" + catalogName + "','" + tableName + "', '" + columnName + "','" + newColumnName +  "')");
	}

	public void deleteCatalog(String catalogName) throws SQLException
	{
		stmt.execute("select cas_delete_catalog('" + catalogName + "')");
	}
	
	public void executeQuery(String query) throws java.sql.SQLException
	{
		conn.setAutoCommit(false);    
		/* Ensure that the autocommit is turned off, since only in that case the
		 * cursor based ResultSet is working
		 */ 
		logger.debug("Executing Query: "+ query);
		PreparedStatement pstmt = conn.prepareStatement(query,ResultSet.TYPE_FORWARD_ONLY,ResultSet.CONCUR_READ_ONLY);
		pstmt.setFetchSize(100);
		this.qr = new QueryResults(pstmt.executeQuery());
	}

	public void executeSimpleQuery(String query) throws java.sql.SQLException
	{
		stmt.execute(query);
	}	

	public static String getInternalLoginName(String user)
	{
		return "cas_"+user;
	}
	
	public class QueryResults
	{
		public QueryResults(ResultSet rs) throws SQLException
		{
			this.rs = rs;
			this.rsmd = this.rs.getMetaData();
			ncols = rsmd.getColumnCount();
			baseCatalogNameArray = new String[ncols];
			baseTableNameArray = new String[ncols];
			baseColumnNameArray = new String[ncols];
			columnNameArray = new String[ncols];      
			ucdArray = new String[ncols];
			unitArray = new String[ncols];
			datatypeArray = new String[ncols];
		}

		public void close() throws SQLException
		{
			rs.close();
		}    
 
		public boolean next()  throws SQLException
		{
			return rs.next();
		}

		public int getColumnCount() throws SQLException
		{
			return ncols;
		}

		public String getString(String s) throws SQLException
		{
			return rs.getString(s);
		}

		public String getString(int n)  throws SQLException
		{
			return rs.getString(n);
		}

		public String[] getStringArray()  throws SQLException
		{
			String[] arr = new String[ncols];
			for (int i = 1; i<=ncols; i++)
			{
				arr[i - 1] = rs.getString(i);
			}
			return arr;
		}

		public String getColumnName(int n)  throws SQLException
		{
			if (columnNameArray[n-1] == null)
			{
				columnNameArray[n-1] = rsmd.getColumnName(n);
			}
			return columnNameArray[n-1];
		}


		public String getBaseColumnName(int n)  throws SQLException
		{
			if (baseColumnNameArray[n-1]==null)
			{
				baseColumnNameArray[n-1]=((org.postgresql.PGResultSetMetaData)rsmd).getBaseColumnName(n);
			}
			return baseColumnNameArray[n-1];
		}

		public String[] getBaseColumnNameArray()  throws SQLException
		{
			for (int n = 1; n < ncols; n++)
			{
				if (baseColumnNameArray[n - 1] == null)
				{
					baseColumnNameArray[n - 1] = ((org.postgresql.PGResultSetMetaData)rsmd).getBaseColumnName(n);
				}
			}
			return baseColumnNameArray;
		}

		public String[] getColumnNameArray()  throws SQLException
		{
			for (int n = 1; n < ncols; n++)
			{
				if (columnNameArray[n - 1] == null)
				{
					columnNameArray[n - 1] = rsmd.getColumnName(n);
				}
			}
			return columnNameArray;
		}

		public String getBaseTableName(int n)  throws SQLException
		{
			if (baseTableNameArray[n-1]==null)
			{
				baseTableNameArray[n-1] = ((org.postgresql.PGResultSetMetaData)rsmd).getBaseTableName(n);
			}
			return baseTableNameArray[n-1];
		}

		public String getBaseCatalogName(int n)  throws SQLException
		{
			if (baseCatalogNameArray[n-1]==null)
			{
				baseCatalogNameArray[n-1] = ((org.postgresql.PGResultSetMetaData)rsmd).getBaseSchemaName(n);
			}
			return  baseCatalogNameArray[n-1];
		}

		public String getUcd(int n)  throws SQLException
		{
			if (ucdArray[n-1]==null)
			{
				PreparedStatement stmt = conn.prepareStatement("select cas_get_column_ucd(?, ?, ?)");
				stmt.setString(1, getBaseCatalogName(n));
				stmt.setString(2, getBaseTableName(n));
				stmt.setString(3, getBaseColumnName(n));
				ResultSet rs = stmt.executeQuery(); 
				rs.next();
				ucdArray[n - 1] = rs.getString(1);
				if (ucdArray[n-1]==null) ucdArray[n-1]="";        
				rs.close();
				stmt.close();
			}
			return ucdArray[n-1];
		}

		public String getDatatype(int n)  throws SQLException
		{
			if (datatypeArray[n - 1] == null)
			{
				PreparedStatement stmt = conn.prepareStatement("select cas_get_column_external_datatype(?, ?, ?)");
				stmt.setString(1, getBaseCatalogName(n));
				stmt.setString(2, getBaseTableName(n));
				stmt.setString(3, getBaseColumnName(n));
				ResultSet rs = stmt.executeQuery(); 
				rs.next();
				datatypeArray[n - 1] = rs.getString(1);
				rs.close();
				stmt.close();
			}
			return datatypeArray[n - 1];
		}


		public String getUnit(int n)  throws SQLException
		{
			if (unitArray[n-1]==null)
			{
				PreparedStatement stmt = conn.prepareStatement("select cas_get_column_unit(?, ?, ?)");
				stmt.setString(1, getBaseCatalogName(n));
				stmt.setString(2, getBaseTableName(n));
				stmt.setString(3, getBaseColumnName(n));
				ResultSet rs = stmt.executeQuery(); 
				rs.next();
				unitArray[n - 1] = rs.getString(1);
				if (unitArray[n - 1] == null) 
				{
					unitArray[n - 1] = "";
				}
				rs.close();
				stmt.close();
			}
			return unitArray[n-1];
		}

		public String getColumnInfo(int n)  throws SQLException
		{
			PreparedStatement pstmt = conn.prepareStatement("select cas_get_column_info(?, ?, ?)");
			pstmt.setString(1, getBaseCatalogName(n));
			pstmt.setString(2, getBaseTableName(n));
			pstmt.setString(3, getBaseColumnName(n));
			ResultSet rs = pstmt.executeQuery(); 
			rs.next();
			String columnInfo = rs.getString(1);
			if (columnInfo == null) 
			{
				columnInfo = "";
			}
			rs.close();
			pstmt.close();
			return columnInfo;
		}


		public String getColumnDescription(int n)  throws SQLException
		{
			PreparedStatement stmt = conn.prepareStatement("select cas_get_column_description(?, ?, ?)");
			stmt.setString(1, getBaseCatalogName(n));
			stmt.setString(2, getBaseTableName(n));
			stmt.setString(3, getBaseColumnName(n));
			ResultSet rs = stmt.executeQuery(); 
			rs.next();
			String columnDescription = rs.getString(1);
			if (columnDescription == null)
			{
				columnDescription = "";
			}
			rs.close();
			stmt.close();      
			return columnDescription;
		}

		private String[] baseCatalogNameArray;
		private String[] baseTableNameArray;
		private String[] baseColumnNameArray;
		private String[] columnNameArray;
		private String[] ucdArray;
		private String[] unitArray;
		private String[] datatypeArray;    

		private ResultSet rs;
		private ResultSetMetaData rsmd;
		private int ncols;
	};
	
}
